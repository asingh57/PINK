ETCD STRUCTURE

/machines (These are individual processing machines)
  IPADDRESS (these are individual IPs)
    name (name of the machine) (manually assigned by web servers only)
    status 
      (status of the machine)
      possible values: 
        server_available=0
        server_unavailable=1
    upload_spots_available:
      (number of spots available for uploads) (self calculated by the machine itself)
    stop_signal
      (signal by a web server to order machine to shut itself down) (note that the web server will have to ssh into the machine and restart the service pink_service manually)
      possible values:
        stop_server_process_uploads=0
          (mark the server down, accept, no new uploads but keep processing all jobs that are already on there)
          (including unprocessed uploads) STRONGLY RECOMMENDED, SET IT BACK UP 
        stop_server_ignore_uploads=1
          (mark the server down, but keep processing jobs that are already running)
          #SAFE BUT SOFT STOP IS PREFERABLE
        hard_stop_server=2
          (forcibly stop all containers immediately, without backup)
          #USE ONLY IF ABSOLUTELY NECESSARY SINCE ALL CURRENTLY RUNNING IMAGES WOULD START FROM SCRATCH. THIS STOPS THE SERVICE AND NEEDS TO BE MANUALLY ENABLED
        run_server=3
          (keep the server running or start server. Setting this signal will do nothing if a hard stop was made/ the service was stopped)

/users (individual users)
  USERNAME
    DOCKERNAME
      status 
        (status of the individual job)
          possible values:
            uploaded_to_web_server=0,
            uploaded_to_processing_server=1
            process_errored=2 
            process_stopped_backend_unavailable=3
            process_running=4
            process_completed=5
      processing_machine_address
        (address of the machine where it is being processed)
      processing_machine_name
        (name of the machine where it gets processed)
      docker_output_path 
        (location inside the docker where the output will be present) 
      sigterm_time
        (time when sigterm should be sent)
      hard_stop_time
        (time when docker should be forcibly stopped)
      output_server
        (server where download is made available)
      output_tar_path
        (location where this download is located on the output server)
          