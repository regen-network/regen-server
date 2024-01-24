FROM postgis/postgis:14-master
RUN echo "CREATE DATABASE regen_registry_shadow;" >> /docker-entrypoint-initdb.d/init.sql