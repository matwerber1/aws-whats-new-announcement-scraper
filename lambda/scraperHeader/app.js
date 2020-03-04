const axios = require("axios");
const cheerio = require("cheerio");
const md5 = require("md5");

const { convertArrayToCSV } = require('convert-array-to-csv');

var AWS = require("aws-sdk");
const AWSENV = process.env.AWSENV;
const TABLE = process.env.TABLE;
const BUCKET = process.env.BUCKET;

var ddb; 

if (AWSENV == 'SAM_LOCAL') {
    ddb = new AWS.DynamoDB.DocumentClient({ endpoint: "http://docker.for.mac.localhost:8000/" });
}
else {
    ddb = new AWS.DynamoDB.DocumentClient();
}

const s3 = new AWS.S3(); 

exports.lambdaHandler = async (event, context) => {

    var urls = [
        "https://aws.amazon.com/about-aws/whats-new/2020/",
        "https://aws.amazon.com/about-aws/whats-new/2019/",
        "https://aws.amazon.com/about-aws/whats-new/2018/"
    ];

    var announcements = [];

    for (var i in urls) {

        var url = urls[i];
        console.log(`Fetching ${url}`);
        var response = await axios.get(url);
        var $ = cheerio.load(response.data);

        console.log(`Parsing results...`);
        $(".directory-item.text.whats-new").each((index, item) => {
            var title = $("h3", item).text();
            var description = $(".description p", item).text();
            var dateString = $(".date", item).text();
            // Date has some extra characters we don't want, so we strip it out with Regex:
            var dateRegex = /(?<=Posted On: )[a-zA-Z]{3} \d{1,2}, \d{4}(?<!=)/;
            dateString = dateString.match(dateRegex)[0];
            var { date, yearMonth, year } = parseDateFromHtml(dateString);
            var link = $(".reg-cta b a", item).attr('href');
            // The HTML links are preceded by a double-slash, which isn't valid; let's remove and replace with https://
            var doubleSlashRegex = /^\/{2}/;
            link = link.replace(doubleSlashRegex, 'https://');
            // We will use a hash of several values as our unique ID, since some announcements have identical titles: 
            var id = md5(title + date + link);

            announcements.push({
                id: id,
                recordType: 'header',
                title: title,
                description: description || '<<no description>>',
                date: date,
                yearMonth: yearMonth, 
                year: year, 
                link: link
            });
        });
    }

    console.log(`Scraped ${announcements.length} announcements...`);
 
    console.log('Writing results to S3...');
    await writeHeaderItemsToS3(announcements);

    console.log(`Chunking results into batches for DynamoDB...`);
    var announcementBatches = chunk(announcements, 25);

    console.log(`Writing results to DynamoDB...`);
    for (const batch of announcementBatches) {
        await writeHeaderItemsToTable(batch);
    }

    return 'Done!';
    
};

/**
 * The raw HTML gives us dates like this: 
 * "\n              Posted On: Dec 23, 2019 \n            "
 * 
 * The function below parses dates into this: 
 * "2019-12-23"
 */
function parseDateFromHtml(dateString) {

    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var dayRegex = /(?<=[a-zA-Z ]{4})\d{1,2}(?<!,)/;
    var day = dateString.match(dayRegex);
    // First 3 chars are the month:
    var monthStr = dateString.substring(0, 3);
    // Get the month number from the month string:
    var month = (months.indexOf(monthStr) + 1).toString();
    // Pad single-digit months with a zero so we get nice sorting: 
    month = month.padStart(2, '0');
    var year = dateString.slice(-4);
    var date = `${year}-${month}-${day}`;
    var yearMonth = `${year}-${month}`;
    return ({
        date: date,
        yearMonth: yearMonth,
        year: year
    });

}

async function writeHeaderItemsToTable(items) {

    // Batch write will fail if two items are identical, so first remove duplicates.
    // We wouldn't expect duplicates, but in reality, there are some identical 
    // announcements (same title, date, link) on some of the Whats New pages:
    const uniqueItems = Array.from(new Set(items.map(a => a.id)))
        .map(id => {
            return items.find(a => a.id === id)
        });

    console.log(`Writing batch of ${items.length} items...`);
    var params = { RequestItems: {} };
    params.RequestItems[TABLE] = [];
    
    for (const item of items) {
        params.RequestItems[TABLE].push({
            PutRequest: {
                Item: item
            }
        });
    }
    try {
        await ddb.batchWrite(params).promise();
    }
    catch (err) {
        console.log(err);
        console.log('offending year, titles: ');
        for (const item of items) {
            console.log(`${item.year} - ${item.title}`)
        }
    }
    
}

// Chunk an array into an array of arrays, each of the specified size: 
function chunk(array, size) {
    const chunked_arr = [];
    let index = 0;
    while (index < array.length) {
      chunked_arr.push(array.slice(index, size + index));
      index += size;
    }
    return chunked_arr;
}


async function writeHeaderItemsToS3(items) {
    
    const csvFromArrayOfObjects = convertArrayToCSV(items);
    var params = {
        Body: csvFromArrayOfObjects, 
        Bucket: BUCKET, 
        Key: "whats-new-headers.csv",
       };
    
    await s3.putObject(params).promise(); 
    
}