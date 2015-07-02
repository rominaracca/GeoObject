var restify = require('restify');
var pg      = require('pg.js');
var fs      = require('fs');
var uuid    = require('uuid');

var server = restify.createServer();

// No 'Access-Control-Allow-Origin' header is present on the requested resource. 
// Origin 'http://localhost:9000' is therefore not allowed access. 
server.use(restify.CORS()); 
server.use(restify.fullResponse());
server.use(restify.bodyParser());

//reading config file
var config = JSON.parse(fs.readFileSync('/etc/nodejs-config/GeoObject.json'));

// connection string to GeoObject database
var conString = "postgres://" + 
               config.pg.user + ":" +
               config.pg.pass + "@" + 
               config.pg.host + "/" + 
               config.pg.db;

function validateLocale(localeParam){
   
   
   var array = localeParam.split("-");
   if (array.length != 2){
      console.log("FALSE por array distinto a dos elementos");
      return false;
   }

   pg.connect(conString, function(err, client, done){
    //Return if an error occurs
    if(err) {
      //TODO respond with error code
      console.error('error fetching client from pool', err);
    }

    var sql_code = 'SELECT code FROM geo_object.ISO639_1 WHERE code=';
      sql_code += "'" + array[0] + "'";
    
    client.query(sql_code, function(err, result){

      //Return if an error occurs
      if(err) {
        console.error('error fetching client from pool', err);      
      }

      if(result.rowCount != 1){
        done();
        console.log("FALSE por cantidad de filas distinto de uno_A");
        return false
      }

      var sql_language = 'SELECT code_iso_alfa2 FROM geo_object.country WHERE code_iso_alfa2=';
      sql_language += "'" + array[1].toUpperCase() + "'";

      client.query(sql_code, function(err, result){
        
        //Return if an error occurs
        if(err) {
          console.error('error fetching client from pool', err);      
        }

        if(result.rowCount != 1){
          console.log("FALSE por cantidad de filas distinto de uno_B");
          done();
          return false
        }
        done();
        console.log("TRUE");
        return true;
      });
    });
  });
  return false;
}

server.get(
   {path: '/continents', version:'1.0.0'}, 
   function(req,res){
      pg.connect(conString, function(err, client, done){
      //Return if an error occurs
      if(err) {
         //TODO respond with error code
         console.error('error fetching client from pool', err);
      }

      var sql_locale='SELECT DISTINCT locale FROM geo_object.continent ';
      var responseLocaleArray = [];

      client.query(sql_locale, function(err, result){

         //Return if an error occurs
         if(err) {
            console.error('error fetching client from pool', err);      
         }

         result.rows.forEach(
            function(data) {
               responseLocaleArray.push(data.locale);          
            }
         );

        // Header
        var locale = req.header('Accept-Language', 'es-AR');        //"es-AR" es el valor default en caso de ser null
        var languagesArray = locale.match(/[a-zA-z\-]{2,10}/g) || [];
        var resultDB = "";
        languagesArray.every(
            function(dataLang){
                responseLocaleArray.every(
                    function(dataDB){
                        if(dataLang.toUpperCase() == dataDB.toUpperCase()){
                            resultDB = dataDB;
                            return false;
                        }
                        return true;
                    }
                );
                if(resultDB == "")
                    return false;
                else return true;
            }
        ); 
        
        console.log(resultDB);
        console.log(locale);

        if(resultDB == "") resultDB = "es-AR";

    var sql = 'SELECT id, code, name, description, comment FROM geo_object.continent WHERE erased=false AND locale ilike ';
    sql += "'" + resultDB + "'";
    sql += " ORDER BY name";


          var responseArray = [];
          client.query(sql, function(err, result) {
             //Return if an error occurs
             if(err) {
                console.error('error fetching client from pool', err);      
             }
             // Storing result in an array
             result.rows.forEach(
                function(data) {
                   var dto = {
                      id: data.id,
                      code: data.code,
                      name: data.name,
                      description: data.description,
                      comment: data.comment,
                      _links: {
                         continent: {
                            href: 'http://'+config.host+':'+ config.port + "/continents/" + data.code,
                            type: 'application/json'
                         }
                      }
                   };
                   responseArray.push(dto);
                }
             );
             done(); //release the pg client back to the pool 
             var model = {
                "org.geoobject.model.Continent": responseArray
             };
             res.json(model);
          });

      });
   });
});

server.get(
   {path: '/continents/:code', version:'1.0.0'}, 
   function(req,res){
      pg.connect(conString, function(err, client, done){
      //Return if an error occurs
      if(err) {
         //TODO respond with error code
         console.error('error fetching client from pool', err);
      }
      //querying database
      var sql = 'SELECT id, code, name, description, comment FROM geo_object.continent WHERE erased=false AND code ilike ';
      sql += "'" + req.params.code + "'";
      sql += " ORDER BY name";

      console.log(sql);
      client.query(sql, function(err, result) {
         //Return if an error occurs
         if(err) {
            console.error('error fetching client from pool', err);      
         }
          if(!result.rows[0]) 
            res.send(404);
         else{
            var dto = {
               id: result.rows[0].id,
               code: result.rows[0].code,
               name: result.rows[0].name,
               description: result.rows[0].description,
               comment: result.rows[0].comment,
               _links: {
                  continent: {
                     rel : 'self',
                     href: 'http://'+config.host+':' + config.port + "/continents/" + result.rows[0].code,
                     type: 'application/json'
                  }
               }
            };
            var model = {
               "org.geoobject.model.Continent" : dto
            }
            res.json(model);
         }
         done(); //release the pg client back to the pool 
      });
   });
});


/*** Paises ***/
server.get(
   {path: '/countries', version:'1.0.0'}, 
   function(req,res){
      pg.connect(conString, function(err, client, done){
      //Return if an error occurs
      if(err) {
         //TODO respond with error code
         console.error('error fetching client from pool', err);
      }
      //querying database
      var sql = 'SELECT id, code_iso_alfa2, code_iso_alfa3, code_iso_num, name_iso, common_name, comment, citizenship, entity, entity_code_iso_alfa2 FROM geo_object.country WHERE erased=false';
      sql += " ORDER BY common_name";
      var responseArray = [];
      client.query(sql, function(err, result) {
         //Return if an error occurs
         if(err) {
            console.error('error fetching client from pool', err);      
         }
         // Storing result in an array
         result.rows.forEach(
            function(data) {
               var dto = {
                  id: data.id,
                  code_iso_alfa2: data.code_iso_alfa2,
                  code_iso_alfa3: data.code_iso_alfa3,
                  code_iso_num: data.code_iso_num,
                  name_iso: data.name_iso,
                  common_name: data.common_name,
                  comment: data.comment,
                  citizenship: data.citizenship,
                  entity: data.entity,
                  entity_code_iso_alfa2: data.entity_code_iso_alfa2,
                  _links: {
                     country: {
                        href: 'http://'+config.host+':'+ config.port + "/countries/" + data.code_iso_alfa3,
                        type: 'application/json'
                     }
                  }
               };
               responseArray.push(dto);
            }
         );
         done(); //release the pg client back to the pool 
         var model = {
            "org.geoobject.model.Country": responseArray
         };
         res.json(model);
      });
   });
});



server.get(
   {path: '/countries/:code_iso_alfa3', version:'1.0.0'}, 
   function(req,res){
      pg.connect(conString, function(err, client, done){
      //Return if an error occurs
      if(err) {
         //TODO respond with error code
         console.error('error fetching client from pool', err);
      }
      //querying database
      var sql = 'SELECT id, code_iso_alfa2, code_iso_alfa3, code_iso_num, name_iso, common_name, comment, citizenship, entity, entity_code_iso_alfa2 FROM geo_object.country WHERE erased=false AND code_iso_alfa3 ilike ';
      sql += "'" + req.params.code_iso_alfa3 + "'";
      sql += " ORDER BY common_name";
      console.log(sql);
      client.query(sql, function(err, result) {
         //Return if an error occurs
         if(err) {
            console.error('error fetching client from pool', err);      
         }
          if(!result.rows[0]) 
            res.send(404);
         else{
            var dto = {
                id: result.rows[0].id,
                code_iso_alfa2: result.rows[0].code_iso_alfa2,
                code_iso_alfa3: result.rows[0].code_iso_alfa3,
                code_iso_num: result.rows[0].code_iso_num,
                name_iso: result.rows[0].name_iso,
                common_name: result.rows[0].common_name,
                comment: result.rows[0].comment,
                citizenship: result.rows[0].citizenship,
                entity: result.rows[0].entity,
                entity_code_iso_alfa2: result.rows[0].entity_code_iso_alfa2,
                _links: {
                    country: {
                    rel : 'self',
                    href: 'http://'+config.host+':' + config.port + "/countries/" + result.rows[0].code_iso_alfa3,
                    type: 'application/json'
                  }
               }
            };
            var model = {
               "org.geoobject.model.Country" : dto
            }
            res.json(model);
         }
         done(); //release the pg client back to the pool 
      });
   });
});



server.get(
   {path: '/continents/:code/countries', version:'1.0.0'}, 
   function(req,res){
      pg.connect(conString, function(err, client, done){
      //Return if an error occurs
      if(err) {
         //TODO respond with error code
         console.error('error fetching client from pool', err);
      }
      //querying database
      var sql = 'SELECT country.id, country.code_iso_alfa2, country.code_iso_alfa3, country.code_iso_num, country.name_iso, country.common_name, country.comment, country.citizenship, country.entity, country.entity_code_iso_alfa2 FROM geo_object.country country LEFT JOIN geo_object.continent continent ON country.continent_id = continent.id WHERE country.erased=false AND continent.code ilike ';
        sql += "'" + req.params.code + "'";
        sql += " ORDER BY common_name";
      var responseArray = [];
      client.query(sql, function(err, result) {
         //Return if an error occurs
         if(err) {
            console.error('error fetching client from pool', err);      
         }
         // Storing result in an array
         result.rows.forEach(
            function(data) {
               var dto = {
                  id: data.id,
                  code_iso_alfa2: data.code_iso_alfa2,
                  code_iso_alfa3: data.code_iso_alfa3,
                  code_iso_num: data.code_iso_num,
                  name_iso: data.name_iso,
                  common_name: data.common_name,
                  comment: data.comment,
                  citizenship: data.citizenship,
                  entity: data.entity,
                  entity_code_iso_alfa2: data.entity_code_iso_alfa2,
                  name: data.name,
                  _links: {
                     continent: {
                        href: 'http://'+config.host+':' + config.port + "/continents/" + req.params.code,
                        type: 'application/json'
                     },
                     country: {
                        href: 'http://'+config.host+':' + config.port + "/countries/" + data.code_iso_alfa3,
                        type: 'application/json'
                     }
                  }
               };
               responseArray.push(dto);
            }
         );
         done(); //release the pg client back to the pool 
         var model = {
            "org.geoobject.model.Country": responseArray
         };
         res.json(model);
      });
   });
});


server.del(
    {path: '/continents/:code', version:'1.0.0'},
    function(req,res){
      pg.connect(conString, function(err, client, done){

        //Return if an error occurs
        if(err) {
          console.error('error fetching client from pool', err);
          res.send(503);
        }

        //querying database
        var sql = 'DELETE FROM geo_object.continent WHERE code=';
          sql += "'" + req.params.code + "'";
          sql += " AND locale ilike '" + req.header('Accept-Language') +"'";

        client.query(sql, function(err, result) {
          done();
          //Return if an error occurs
          if(err) {
            //falta de conexion
            console.error('error fetching client from pool', err);
            res.send(503);
          }
          if (result.rowCount == 0) {
            console.error('result not found', err);
            res.send(404);
          }else{
            res.send(200);
          }
        });
      });
    }
);


server.post(
    {path: '/continents', version:'1.0.0'},
    function(req, res){
      //console.log(req.body);

      if(!req.body){
        res.send(400, "falta dato obligatorio");
        return;
      }

      if(!req.header('Accept-Language') || !req.body.code || !req.body.name){
        res.send(400, "falta dato obligatorio");
        return;
      }

       req.body = JSON.parse(req.body);

      //console.log(req.header('Accept-Language'));
      var locale = req.header('Accept-Language')
      var languagesArray = locale.match(/[a-zA-z\-]{2,10}/g) || [];
      
      var array = languagesArray[0].split("-");
      if (array.length != 2){
        res.send(400, "Locale incorrecto"+array);
        return;
      }

      pg.connect(conString, function(err, client, done){

        //Return if an error occurs
        if(err) {
          done();
          res.send(503);
          console.error('error fetching client from pool', err);
          return;
        }

        var sql_code = 'SELECT code FROM geo_object.ISO639_1 WHERE code=';
          sql_code += "'" + array[0] + "'";

        client.query(sql_code, function(err, result){

          //Return if an error occurs
          if(err) {
            done();
            res.send(503);
            console.error('error fetching client from pool', err);
            return;
          }

          if(result.rowCount != 1){
            done();
            res.send(400, "Locale codogo incorrecto"+array);
            console.log("FALSE por cantidad de filas distinto de uno_A");
            return;
          }

          var sql_language = 'SELECT code_iso_alfa2 FROM geo_object.country WHERE code_iso_alfa2=';
            sql_language += "'" + array[1].toUpperCase() + "'";

          client.query(sql_code, function(err, result){
        
            //Return if an error occurs
            if(err) {
              done();
              console.error('error fetching client from pool', err);
              res.send(503);
              return;
            }

            if(result.rowCount != 1){
              done();
              console.log("FALSE por cantidad de filas distinto de uno_B");
              res.send(400, "Locale lenguaje incorrecto"+array);
              return;
            }

            //querying database
            var sql = 'INSERT INTO geo_object.continent VALUES ('+"'"+ uuid.v4() +"'"+', false, ';
              sql += "'" + req.body.code + "', '" + req.body.name + "', '" +  req.body.description + "', '" + req.body.comment +"', '"+ languagesArray[0] + "')";

            console.log(sql);

            client.query(sql, function(err, result) {
              done();

              //Return if an error occurs
              if(err) {
                //falta de conexion
                console.error('error fetching client from pool', err);
                res.send(503);
                return;
              }

              res.send(201);
            });
          });
        });
      }); //cierra connect
    }//cierra funcion
);  


server.put(
    {path: '/continents/:code', version:'1.0.0'},
    function(req, res){
    //name, description, comment

      //409 Conflict - Una solicitud ha fallado debido estado incompatible
      //El cuerpo de la respuesta incluye información suficiente para que el cliente pueda entender y potencialmente solucionar el problema, si es posible.
       if(!req.body){
        res.send(409, "Conflict");
        return;
      }

      pg.connect(conString, function(err, client, done){

        //Return if an error occurs
        if(err) {
          console.error('error fetching client from pool', err);
          res.send(500);
        }

        req.body = JSON.parse(req.body);

        //querying database
        var sql = 'UPDATE geo_object.continent SET ';
          if(!!req.body.name){ //si viene un nombre
            sql += "name='" + req.body.name + "' ";
          }
          if(!!req.body.description){ //si viene un nombre
            sql += "description='" + req.body.description + "' ";
          }
          if(!!req.body.comment){ //si viene un nombre
            sql += "comment='" + req.body.comment + "' ";
          }
            sql += "WHERE code='" + req.params.code + "'";

        //UPDATE geo_object.continent SET name='Prueba' WHERE code='TT';
        console.log(sql);

        client.query(sql, function(err, result) {
          done();
          //Return if an error occurs
          if(err) {
            //falta de conexion
            console.error('error fetching client from pool', err);
            res.send(500);
            return;
          }
          if (result.rowCount == 0) {
            console.error('not found', err);
            res.send(404);  //quiero actualizar algo que no existe
            return;
          }else{
            res.send(204); //respuesta 200 ok/204 not content 
          }
        });
      });
    }
);



server.listen(config.port);
console.log("GeoObject Listening on port " + config.port);