FROM postgis/postgis:14-master
RUN echo "CREATE DATABASE server_shadow;" >> /docker-entrypoint-initdb.d/init.sql