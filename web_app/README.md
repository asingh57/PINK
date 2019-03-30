curl -c cookies.txt -b cookies.txt --insecure -d "user=abc&password=abc" -X POST https://localhost/login
curl -c cookies.txt -b cookies.txt --insecure -X POST https://localhost/upload_job
