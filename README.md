# "AWS Whats New?" Web Scraper

I often find myself wondering what's new and what have I missed with AWS? 

My day job also requires that I stay abreast of all the latest changes, and at the rate AWS innovates, that's no small task. 

One of the first places I look is the [AWS Whats New Announcement Page] for the current year: 
https://aws.amazon.com/about-aws/whats-new/2020/

I thought it'd be fun to scrape these pages and catalog announcements by day and service, then make an interactive search tool where one could enter a service name and see everything that's changed in the last X months.

From that, this project was born.

# Architecture

At the moment, a barebones Lambda scrapes the 2018 through 2020 "What's New on AWS" pages, and then writes the title, date, description, and link to a CSV in S3 and a DynamoDB table. 