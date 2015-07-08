# GeoObject
Projecto en el que se implementa REST. 
Se utiliza Geographic (paises y continentes) como caso de ejemplo para la implementación de REST.

## Configuración
Crear archivo de configuración en **/etc/nodejs-config/GeoObject.json** con formato JSON.

Ejemplo:
 `{
        "port" :8080,
        "host" :"192.168.168.168", 
        "pg"   :{
                "user"  :"user",
                "pass"  :"pass",
                "host"  :"localhost",
                "db"    :"my_db",
                "port"  :5432
                }
}`


$ npm install	//Instala modulos de Node dentro del proyecto.


$ node index.js	//Ejecuta el proyecto
