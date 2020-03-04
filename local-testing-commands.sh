# Locally invoke our Lambda; 
sam local invoke "ScraperHeaderFunction" -n events/env.json

# Run DynamoDB Local
// docker run -p 8000:8000 amazon/dynamodb-local

# List local tables available
// aws dynamodb list-tables --endpoint-url http://localhost:8000

# Create our local test table: 
// aws dynamodb create-table --cli-input-json file://dynamodb/create-scraper-table.json --endpoint-url http://localhost:8000

# Delete table
aws dynamodb delete-table --table-name LocalScraperTable --endpoint-url http://localhost:8000

# Run local web GUI to view DDB tables
 docker run -t -p 8080:80 taydy/dynamodb-manager
