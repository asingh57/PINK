# PINK
PINK is not Kubernetes
 
A simple, fault tolerant cloud orchestration tool that allows GUI/CLI based access to a cluster of CUDA powered servers. Users can simply upload their docker images and have allocated servers load-balance and process them. 

**Note:**  Note that is has only been tested with Ubuntu 18.04.2LTS

The following configuration is recommended for this project, although some of the functions can be aggregated together:


1) One administrator machine with Ansible 2.8 installed. "Control server"
2) At least one machine with apt package manager "Web server(s)", 
    control server has ssh access to these machines
3) At least one server with apt package manager and a Nvidia CUDA capable GPU "Processing server(s)" 
    control server has ssh access to these machines.
4) A linux server with apt. control server has ssh access to this. "load balancer"


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

## Step 0)
Clone the latest repo by
```shell
git clone https://github.com/asingh57/node_cats_sample.git
```


## Step 1)
Add SSL keys for your web app under ssl folder of web app. You can sign your own using openssh or use your own

Configure "servers" file to match the ips of your configuration
Specify which ips you want for etcd, web server, nginx server etc
In each directory under db_server, adjust the templates according to your needs
(For example, for processing machine, set the amount of time a job runs for using the variables in the python service template)

By default, the web app found in  web_app folder does not have a login function implemented. You can login via the test user with username: abc and password: abc
Make sure you implement login according to your organisations specification before deploying this application and use the above user only in a test environment

## Step 2)
install ansible. This repo uses Ansible 2.8 modules which are not available in default apt packages so use the following instead to manually install via the Ansible git repo

[Ansible 2.8 installation guide found here](https://awsbloglink.wordpress.com/2018/10/05/how-to-install-ansible-on-ubuntu-18-04-lts/)

## Step 3)
deploy the ansible playbooks using
```shell
ansible-playbook site.yml -i servers
```

Now the app should be accessible on port 22 of your nginx server. The nginx server will forward your http requests to the web servers.

The following happens upon deployment:
One by one ansible ssh'es into each of the machines specified in servers file

etcd is installed on etcd machines 
nvidia docker2 and nvidia drivers are installed on the gpu servers
a container processing service is executed on gpu server which probes for file inputs
web server npm packages and nodejs are installed on web servers
web servers are put online
web servers are provided ssh access to nvidia gpu machines
nginx is installed on the nginx machine and it forwards all data through to the web servers

etcd is used for communication between web and gpu servers. Both the processing daemon and nodejs app are written taking fault tolerance into consideration. They follow the At Most Once (AMO) property in order to update job statuses and avoid overwriting.
