# PINK
PINK is not Kubernetes

A simple, fault tolerant cloud orchestration tool that allows GUI/CLI based access to a cluster of CUDA powered servers. Users can simply upload their docker images and have allocated servers load-balance and process them.

The following configuration is recommended for this project, although some of the functions can be aggregated together:

1) One administrator machine with Ansible 2.8 installed. "Control server"
2) At least one machine with aptitude package manager "Web server(s)", 
    control server has ssh access to these machines
3) At least one server with aptitude package manager and a Nvidia CUDA capable GPU "Processing server(s)" 
    control server has ssh access to these machines.
4) A linux router connected to all of the above with opkg installed. (In my case, a dd-wrt router) "Web Load Balancer" 
    control server has ssh access to this router
5) A linux server with aptitude package manager "Database server"
    control server has ssh access to this machine

## How it works:
A task is uploaded by the user on the web app or CLI. Here "task" means a docker image
The task is handled by the web server and allocated to one of the processing servers
The processing server processes the task as a container and returns the docker container's file system as a downloadable output to the user

###On the back end:
The router allocates work to individual web servers via nginx
An etcd key store cluster is formed using all machines on the network
The web servers store active transaction details in etcd
web servers make entries about past transactions in the db (essentially a logging system)
The containers are uploaded via SCP into the processing servers
The processing servers run docker containers and update their status on etcd.
Once completed, processing servers return the compressed file system of the docker.




## Step 1)
Add SSL keys for web app under ssl folder of web app
Add SSL keys for db ssl_db folder. You can create your own by following the following
https://mariadb.com/kb/en/library/certificate-creation-with-openssl/

**Note:** 
**Note:** 
## Step 2)


