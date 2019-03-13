CREATE DATABASE IF NOT EXISTS pinkdb;

CREATE TABLE IF NOT EXISTS pinkdb.admins (
  admin_entry_id INT UNSIGNED NOT NULL AUTO_INCREMENT, 
  short_user VARCHAR(30) NOT NULL UNIQUE, /* short user for McGill University.*/
  create_time TIMESTAMP,
  PRIMARY KEY(admin_entry_id)
);

CREATE TABLE IF NOT EXISTS pinkdb.servers (
  server_id INT UNSIGNED NOT NULL AUTO_INCREMENT,  
  server_address VARCHAR(30) NOT NULL, /* network address of the server */
  server_port INT UNSIGNED NOT NULL, 
  server_password VARCHAR(45), /* make sure to encrypt this using AES encrypt when inserting*/
  max_active_dockers INT UNSIGNED NOT NULL, /* number of dockers running at any given time */
  max_queued_dockers INT UNSIGNED NOT NULL, /* number of dockers queued up on server */
  max_computing_time_ms INT UNSIGNED NOT NULL, /* time an active docker will run for */
  docker_cpu_cores INT UNSIGNED NOT NULL, /* cores allocated per container */
  max_docker_fs_size_GB FLOAT UNSIGNED NOT NULL, /* max volume size for docker */
  max_containers_per_user INT UNSIGNED NOT NULL, /* max containers a user can make on this server */
  is_available BOOLEAN NOT NULL, /* bool to check if marked down for maintenance by admins */
  added_by VARCHAR(30) NOT NULL, /* which admin added this server entry */
  is_active BOOLEAN NOT NULL, /* check if this entry for this server is still valid */
  create_time TIMESTAMP,
  FOREIGN KEY (added_by) REFERENCES admins(short_user), 
  CONSTRAINT valid_comp_time CHECK (max_computing_time_ms>0),
  CONSTRAINT valid_docker_size CHECK (max_docker_size_GB>0),
  PRIMARY KEY(server_id)
);

CREATE TABLE IF NOT EXISTS pinkdb.containers (
  container_id INT UNSIGNED NOT NULL UNIQUE AUTO_INCREMENT, 
  allocated_server INT UNSIGNED NOT NULL,  /* server id allocated to this container */
  is_completed BOOLEAN NOT NULL, /* if container has finished */
  added_by VARCHAR(30) NOT NULL UNIQUE, /* which McGill user added this container */
  create_time TIMESTAMP,
  FOREIGN KEY (allocated_server) REFERENCES servers(server_id),
  PRIMARY KEY(container_id)
);

CREATE TABLE IF NOT EXISTS pinkdb.active_containers(
  container_id INT UNSIGNED NOT NULL, 
  start_time TIMESTAMP, /* time when container was started */
  use_sigint BOOLEAN, /* whether container requires a sigint before it ends */
  sigint_time_ms TIMESTAMP, /* time when a sig int should be sent to the container so it has time to wrap up */
  sigint_process_name VARCHAR(30), /* process inside container which should receive the sigint*/
  expected_end_time TIMESTAMP, /* expected time when this container will end */
  FOREIGN KEY (container_id) REFERENCES containers(container_id)
);



DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');
/*
Disable remote root access
*/

FLUSH PRIVILEGES; 