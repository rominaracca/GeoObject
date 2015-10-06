var restify = require('restify');
var pg      = require('pg.js');
var fs      = require('fs');
var uuid    = require('uuid');

var server = restify.createServer();

var corsOptions={
        headers : [ "location"]
}
server.use(restify.CORS(corsOptions));
// No 'Access-Control-Allow-Origin' header is present on the requested resource. 
// Origin 'http://localhost:9000' is therefore not allowed access. 

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


/************************* GET *************************/
/*
If the GET request is successful, the service will respond with a 200 OK status code and a representation of the state of the resource.

We’re only going to consider two failure cases for GET. 
The first is where the client requests a continent that doesn’t exist, and 
the second is where the server fails in an unspecified manner. 
For these situations we use the 404 and 500 status codes to signify that a continent hasn’t been found or that the server failed, respectively.
*/


/*GET list of continents.*/
server.get(
   {path: '/continents', version:'1.0.0'}, 
   function(req,res,next){
      pg.connect(conString, function(err, client, done){
      
      //Return if an error occurs
      if(err) {
        done();
        console.error('error fetching client from pool', err);
        res.send(500);
        return next();
      }

      var sql_locale='SELECT DISTINCT locale FROM geo_object.continent ';
      var responseLocaleArray = [];

      client.query(sql_locale, function(err, result){

        //Return if an error occurs
        if(err) {
          done();
          console.error('error fetching client from pool', err);
          res.send(500, {code: 500, message: 'Internal Server Error', description: 'Error fetching client from pool. Try again later'});
          return next();
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

        //console.log(resultDB);
        //console.log(locale);

        if(resultDB == "") resultDB = "es-AR";

        var sql = 'SELECT id, code, name, description, comment FROM geo_object.continent WHERE erased=false AND locale ilike ';
          sql += "'" + resultDB + "'";
          sql += " ORDER BY name";

        var responseArray = [];
        client.query(sql, function(err, result) {
          done(); //release the pg client back to the pool 
          //Return if an error occurs
          if(err) {
            console.error('error fetching client from pool', err);
            res.send(500, {code: 500, message: 'Internal Server Error', description: 'Error fetching client from pool. Try again later'});
            return next();
          }
          if(!result.rows[0]){
            res.send(404, {code: 404, message: 'Not Found', description: 'Continent not found.'});
            return next();
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
          var model = {
            "org.geoobject.model.Continent": responseArray
          };
          res.json(model);
          res.send(200);
        });
      });
   });
});


/*GET continent by code.*/
server.get(
    {path: '/continents/:code', version:'1.0.0'}, 
    function(req,res,next){
      pg.connect(conString, function(err, client, done){
      //Return if an error occurs
      if(err) {
        done(); //release the pg client back to the pool
        console.error('error fetching client from pool', err);
        res.send(500, {code: 500, message: 'Internal Server Error', description: 'Error fetching client from pool. Try again later'});
        return next();
      }

      //querying database
      var sql = 'SELECT id, code, name, description, comment FROM geo_object.continent WHERE erased=false AND code ilike ';
        sql += "'" + req.params.code + "'";
        sql += " ORDER BY name";
      //console.log(sql);

      client.query(sql, function(err, result) {
        done(); //release the pg client back to the pool 
        //Return if an error occurs
        if(err) {
          console.error('error fetching client from pool', err);
          res.send(500, {code: 500, message: 'Internal Server Error', description: 'Error fetching client from pool. Try again later'});
          return next();
        }

        if(!result.rows[0]){
          res.send(404, {code: 404, message: 'Not Found', description: 'Continent not found.'});
          return next();
        }
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
        res.send(200);
      });
    });
});


/*GET list of countries.*/
server.get(
    {path: '/countries', version:'1.0.0'}, 
    function(req,res,next){
      pg.connect(conString, function(err, client, done){
        //Return if an error occurs
        if(err) {
          done(); //release the pg client back to the pool 
          console.error('error fetching client from pool', err);
          res.send(500, {code: 500, message: 'Internal Server Error', description: 'Error fetching client from pool. Try again later'});
          return next();
        }

        //querying database
        var sql = 'SELECT id, code_iso_alfa2, code_iso_alfa3, code_iso_num, name_iso, common_name, comment, citizenship, phone_code, entity, entity_code_iso_alfa2 FROM geo_object.country WHERE erased=false';
          sql += " ORDER BY common_name";
        var responseArray = [];
        client.query(sql, function(err, result) {
          done(); //release the pg client back to the pool 
          if(err) {
            console.error('error fetching client from pool', err);
            res.send(500, {code: 500, message: 'Internal Server Error', description: 'Error fetching client from pool. Try again later'});
            return next();
          }

          if(!result.rows[0]){
            res.send(404, {code: 404, message: 'Not Found', description: 'Countries not found.'});
            return next();
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
		flag: 'http://'+config.host+':'+ config.port + "/flags/" + data.code_iso_alfa3.toLowerCase() +".svg",
                comment: data.comment,
                citizenship: data.citizenship,
                phone_code: data.phone_code,
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
          var model = {
            "org.geoobject.model.Country": responseArray
          };
          res.json(model);
          res.send(200);
        });
    });
});

/*GET flags.*/
server.get(/\/flags\/?.*/, restify.serveStatic({
  directory: __dirname
}));


/*GET country by code_iso_alfa3.*/
/*server.get(
    {path: '/countries/:code_iso_alfa3', version:'1.0.0'}, 
    function(req,res,next){
      console.log("el code");
      pg.connect(conString, function(err, client, done){
      //Return if an error occurs
      if(err) {
        done(); //release the pg client back to the pool 
        console.error('error fetching client from pool', err);
        res.send(500);
        return next();
      }

      //querying database
      var sql = 'SELECT id, code_iso_alfa2, code_iso_alfa3, code_iso_num, name_iso, common_name, comment, citizenship, entity, entity_code_iso_alfa2 FROM geo_object.country WHERE erased=false AND code_iso_alfa3 ilike ';
        sql += "'" + req.params.code_iso_alfa3 + "'";
        sql += " ORDER BY common_name";
      console.log(sql);

      client.query(sql, function(err, result) {
        done(); //release the pg client back to the pool 
        //Return if an error occurs
        if(err) {
          console.error('error fetching client from pool', err);
          res.send(500);
          return next();
        }

        if(!result.rows[0]) {
          res.send(404);
          return next();
        }
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
        res.send(200);
      });
   });
});
*/

/*GET the countries of a continent(code)*/
server.get(
    {path: '/continents/:code/countries', version:'1.0.0'}, 
    function(req,res,next){
      pg.connect(conString, function(err, client, done){
      //Return if an error occurs
      if(err) {
        done(); //release the pg client back to the pool 
        console.error('error fetching client from pool', err);
        res.send(500, {code: 500, message: 'Internal Server Error', description: 'Error fetching client from pool. Try again later'});
        return next();
      }

      //querying database
      var sql = 'SELECT country.id, country.code_iso_alfa2, country.code_iso_alfa3, country.code_iso_num, country.name_iso, country.common_name, country.comment, country.citizenship, country.phone_code, country.entity, country.entity_code_iso_alfa2 FROM geo_object.country country LEFT JOIN geo_object.continent continent ON country.continent_id = continent.id WHERE country.erased=false AND continent.code ilike ';
        sql += "'" + req.params.code + "'";
        sql += " ORDER BY common_name";
      var responseArray = [];

      client.query(sql, function(err, result) {
        done(); //release the pg client back to the pool 
        //Return if an error occurs
        if(err) {
          console.error('error fetching client from pool', err);
          res.send(500, {code: 500, message: 'Internal Server Error', description: 'Error fetching client from pool. Try again later'});
          return next();
        }

        if(!result.rows[0]) {
          res.send(404, {code: 404, message: 'Not Found', description: 'Countries not found.'});
          return next();
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
              flag: 'http://'+config.host+':'+ config.port + "/flags/" + data.code_iso_alfa3.toLowerCase() +".svg",
              comment: data.comment,
              citizenship: data.citizenship,
              phone_code: data.phone_code,
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
        var model = {
          "org.geoobject.model.Country": responseArray
        };
        res.json(model);
        res.send(200);
      });
    });
});


/*GET list of provinces.*/
server.get(
    {path: '/provinces', version:'1.0.0'}, 
    function(req,res,next){
      pg.connect(conString, function(err, client, done){
        //Return if an error occurs
        if(err) {
          done(); //release the pg client back to the pool 
          console.error('error fetching client from pool', err);
          res.send(500, {code: 500, message: 'Internal Server Error', description: 'Error fetching client from pool. Try again later'});
          return next();
        }

        //querying database
        var sql = 'SELECT id, code_iso, name, description, comment FROM geo_object.province WHERE erased=false ORDER BY name';

        var responseArray = [];
        client.query(sql, function(err, result) {
          done(); //release the pg client back to the pool 
          if(err) {
            console.error('error fetching client from pool', err);
            res.send(500, {code: 500, message: 'Internal Server Error', description: 'Error fetching client from pool. Try again later'});
            return next();
          }

          if(!result.rows[0]){
            res.send(404, {code: 404, message: 'Not Found', description: 'Countries not found.'});
            return next();
          }
          // Storing result in an array
          result.rows.forEach(
            function(data) {
              var dto = {
                id: data.id,
                code_iso: data.code_iso,
                name: data.name,
                description: data.description,
                comment: data.comment,
                _links: {
                  province: {
                    href: 'http://'+config.host+':'+ config.port + "/provinces/" + data.code_iso,
                    type: 'application/json'
                  }
                }
              };
              responseArray.push(dto);
            }
          );
          var model = {
            "org.geoobject.model.Province": responseArray
          };
          res.json(model);
          res.send(200);
        });
    });
});


/*GET province by code.*/
server.get(
    {path: '/provinces/:code', version:'1.0.0'}, 
    function(req,res,next){
      pg.connect(conString, function(err, client, done){
      //Return if an error occurs
      if(err) {
        done(); //release the pg client back to the pool
        console.error('error fetching client from pool', err);
        res.send(500, {code: 500, message: 'Internal Server Error', description: 'Error fetching client from pool. Try again later'});
        return next();
      }

      //querying database
      var sql = 'SELECT id, code_iso, name, description, comment FROM geo_object.province WHERE erased=false AND code_iso ilike ';
        sql += "'" + req.params.code + "'";
      //console.log(sql);

      client.query(sql, function(err, result) {
        done(); //release the pg client back to the pool 
        //Return if an error occurs
        if(err) {
          console.error('error fetching client from pool', err);
          res.send(500, {code: 500, message: 'Internal Server Error', description: 'Error fetching client from pool. Try again later'});
          return next();
        }

        if(!result.rows[0]){
          res.send(404, {code: 404, message: 'Not Found', description: 'Province not found.'});
          return next();
        }
        var dto = {
          id: result.rows[0].id,
          code_iso: result.rows[0].code_iso,
          name: result.rows[0].name,
          description: result.rows[0].description,
          comment: result.rows[0].comment,
          _links: {
            continent: {
              rel : 'self',
              href: 'http://'+config.host+':' + config.port + "/provinces/" + result.rows[0].code_iso,
              type: 'application/json'
            }
          }
        };
        var model = {
          "org.geoobject.model.Province" : dto
        }
        res.json(model);
        res.send(200);
      });
    });
});


/*GET list provinces of a country(code)*/
server.get(
    {path: '/countries/:code/provinces', version:'1.0.0'}, 
    function(req,res,next){
      pg.connect(conString, function(err, client, done){
      //Return if an error occurs
      if(err) {
        done(); //release the pg client back to the pool 
        console.error('error fetching client from pool', err);
        res.send(500, {code: 500, message: 'Internal Server Error', description: 'Error fetching client from pool. Try again later'});
        return next();
      }

      //querying database
      var sql = 'SELECT province.id, province.code_iso, province.name, province.description, province.comment FROM geo_object.province province LEFT JOIN geo_object.country country ON province.country_id = country.id WHERE province.erased=false AND country.code_iso_alfa3 ilike ';
        sql += "'" + req.params.code + "'";
        sql += " ORDER BY name";

      var responseArray = [];

      client.query(sql, function(err, result) {
        done(); //release the pg client back to the pool 
        //Return if an error occurs
        if(err) {
          console.error('error fetching client from pool', err);
          res.send(500, {code: 500, message: 'Internal Server Error', description: 'Error fetching client from pool. Try again later'});
          return next();
        }

        if(!result.rows[0]) {
          res.send(404, {code: 404, message: 'Not Found', description: 'Countries not found.'});
          return next();
        }
        // Storing result in an array
        result.rows.forEach(
          function(data) {
            var dto = {
              id: data.id,
              code_iso: data.code_iso,
              name: data.name,
              description: data.description,
              comment: data.comment,
              _links: {
                country: {
                  href: 'http://'+config.host+':' + config.port + "/countries/" + req.params.code,
                  type: 'application/json'
                },
                province: {
                  href: 'http://'+config.host+':' + config.port + "/provinces/" + data.code_iso,
                  type: 'application/json'
                }
              }
            };
            responseArray.push(dto);
          }
        );
        var model = {
          "org.geoobject.model.Province": responseArray
        };
        res.json(model);
        res.send(200);
      });
    });
});




/*GET countries by latitude,longitude OR code_iso_alfa3*/
server.get(
    {path: /^\/([a-zA-Z0-9_\.~-]+)\/(.*)/, version:'1.0.0'},
    function(req,res,next){

      if(req.params[0] == 'countries'){

        var array = req.params[1].split(",");

        if(array.length == 2){  /*GET countries by latitude and longitude*/

          pg.connect(conString, function(err, client, done){
            //Return if an error occurs
            if(err) {
              done(); //release the pg client back to the pool
              console.error('error fetching client from pool', err);
              res.send(500, {code: 500, message: 'Internal Server Error', description: 'Error fetching client from pool. Try again later'});
              return next();
            }

            //querying database
            var sql = 'SELECT id, code_iso_alfa2, code_iso_alfa3, code_iso_num, name_iso, common_name, comment, citizenship, phone_code, latitude, longitude, entity, entity_code_iso_alfa2 FROM geo_object.country WHERE erased=false AND latitude=';
              sql += "'" + array[0] + "' AND longitude=";
              sql += "'" + array[1] + "'";
            //console.log(sql);

            client.query(sql, function(err, result) {
              done(); //release the pg client back to the pool 
              //Return if an error occurs
              if(err) {
                console.error('error fetching client from pool', err);
                res.send(500, {code: 500, message: 'Internal Server Error', description: 'Error fetching client from pool. Try again later'});
                return next();
              }

              if(!result.rows[0]) {
                res.send(404, {code: 404, message: 'Not Found', description: 'Country not found.'});
                return next();
              }
              
              var dto = {
                id: result.rows[0].id,
                code_iso_alfa2: result.rows[0].code_iso_alfa2,
                code_iso_alfa3: result.rows[0].code_iso_alfa3,
                code_iso_num: result.rows[0].code_iso_num,
                name_iso: result.rows[0].name_iso,
                common_name: result.rows[0].common_name,
		flag: 'http://'+config.host+':'+ config.port + "/flags/" + result.rows[0].code_iso_alfa3.toLowerCase() +".svg",
                comment: result.rows[0].comment,
                citizenship: result.rows[0].citizenship,
                phone_code: result.rows[0].phone_code,
                latitude: result.rows[0].latitude,
                longitude: result.rows[0].longitude,
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
              res.send(200);
              return next();
            });//client.query
          });
        }//if=2
        else{   /*GET country by code_iso_alfa3*/
          pg.connect(conString, function(err, client, done){
            //Return if an error occurs
            if(err) {
              done(); //release the pg client back to the pool 
              console.error('error fetching client from pool', err);
              res.send(500, {code: 500, message: 'Internal Server Error', description: 'Error fetching client from pool. Try again later'});
              return next();
            }

            //querying database
            var sql = 'SELECT id, code_iso_alfa2, code_iso_alfa3, code_iso_num, name_iso, common_name, comment, citizenship, phone_code, entity, entity_code_iso_alfa2 FROM geo_object.country WHERE erased=false AND code_iso_alfa3 ilike ';
              sql += "'" + req.params[1] + "'";
              sql += " ORDER BY common_name";
            //console.log(sql);

            client.query(sql, function(err, result) {
              done(); //release the pg client back to the pool 
              //Return if an error occurs
              if(err) {
                console.error('error fetching client from pool', err);
                res.send(500, {code: 500, message: 'Internal Server Error', description: 'Error fetching client from pool. Try again later'});
                return next();
              }

              if(!result.rows[0]) {
                res.send(404, {code: 404, message: 'Not Found', description: 'Country not found.'});
                return next();
              }
              var dto = {
                id: result.rows[0].id,
                code_iso_alfa2: result.rows[0].code_iso_alfa2,
                code_iso_alfa3: result.rows[0].code_iso_alfa3,
                code_iso_num: result.rows[0].code_iso_num,
                name_iso: result.rows[0].name_iso,
                common_name: result.rows[0].common_name,
		flag: 'http://'+config.host+':'+ config.port + "/flags/" + result.rows[0].code_iso_alfa3.toLowerCase() +".svg",
                comment: result.rows[0].comment,
                citizenship: result.rows[0].citizenship,
                phone_code: result.rows[0]. phone_code,
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
              res.send(200);
            });
          });
        }//fin else
        return next();
      }
      return next();
});


/************************* DELETE *************************/
/*
If the GET request is successful, the service will respond with a 204 No Content status code.

If it can’t be deleted, a 405 Method Not Allowed response would be used.

If the client has specified a URI that the server cannot map to a "continent", a 404 Not Found response would be used.

If the service is unavailable to respond to our DELETE request for some other reason, 
the client can expect a 503 Service Unavailable response and might try the request again later.
*/

/* Remove continent by code*/
server.del(
    {path: '/continents/:code', version:'1.0.0'},
    function(req,res,next){
      pg.connect(conString, function(err, client, done){

        //Return if an error occurs
        if(err) {
          done(); //release the pg client back to the pool 
          console.error('error fetching client from pool', err);
          res.send(503, {code: 503, message: 'Service Unavailable', description: 'Error fetching client from pool. Try again later'});
          return next();
        }

        //querying database
        var sql = 'DELETE FROM geo_object.continent WHERE code=';
          sql += "'" + req.params.code + "'";
          sql += " AND locale ilike '" + req.header('Accept-Language') +"'";

        client.query(sql, function(err, result) {
          done(); //release the pg client back to the pool 
          //Return if an error occurs
          if(err) {//falta de conexion
            console.error('error fetching client from pool', err);
            res.send(503, {code: 503, message: 'Service Unavailable', description: 'Error fetching client from pool. Try again later'});
            return next();
          }
          if (result.rowCount == 0) {
            console.error('result not found', err);
            res.send(404, {code: 404, message: 'Not Found', description: 'Delete something that does not exist'});
            return next();
          }else{
            res.send(204);
          }
        });
      });
    }
);


/************************* CREATE *************************/
/*
If the POST request succeeds, the server creates an order resource. It then generates an HTTP response with a status code of 201 Created.

400 Bad Request , when the client sends a malformed request to the service.

500 Internal Server Error , for those rare cases where the server faults and cannot recover internally.
*/

/*Create a new continent*/
server.post(
    {path: '/continents', version:'1.0.0'},
    function(req,res,next){

      if(!req.body){
        res.send(400, {code: 400, message: 'Bad Request', description: 'Empty body. Body format... {\"name\":\"nameTest\", \"code\":\"codeTest\"}'});
        return next();
      }

      if(!req.header('Accept-Language')){
        res.send(400, {code: 400, message: 'Bad Request', description: 'Required header Accept-Language'});
        return next();
      }
      if(!req.body.code){
        res.send(400, {code: 400, message: 'Bad Request', description: 'Required body CODE'});
        return next();
      }
      if(!req.body.name){
        res.send(400, {code: 400, message: 'Bad Request', description: 'Required body NAME'});
        return next();
      }

      //req.body = JSON.parse(req.body); //habilitar esta linea si el cliente envia un string y no un JSON

      var locale = req.header('Accept-Language')
      var languagesArray = locale.match(/[a-zA-z\-]{2,10}/g) || [];
      var array = languagesArray[0].split("-");
      if (array.length != 2){
        res.send(400, {code: 400, message: 'Bad Request', description: 'Accept-Language header. Invalid ' + array});
        return next();
      }

      pg.connect(conString, function(err, client, done){
        //Return if an error occurs
        if(err) {
          done();
          console.error('error fetching client from pool', err);
          res.send(503, {code: 503, message: 'Service Unavailable', description: 'Error fetching client from pool. Try again later'});
          return next();
        }

        var sql_code = 'SELECT code FROM geo_object.ISO639_1 WHERE code=';
          sql_code += "'" + array[0] + "'";

        client.query(sql_code, function(err, result){
          //Return if an error occurs
          if(err) {
            done();
            console.error('error fetching client from pool', err);
            res.send(503, {code: 503, message: 'Service Unavailable', description: 'Error fetching client from pool. Try again later'});
            return next();
          }

          if(result.rowCount != 1){
            done();
            res.send(400, {code: 400, message: 'Bad Request', description: 'Accept-Language header. Invalid code' + array});
            return next();
          }

          var sql_language = 'SELECT code_iso_alfa2 FROM geo_object.country WHERE code_iso_alfa2=';
            sql_language += "'" + array[1].toUpperCase() + "'";

          client.query(sql_language, function(err, result){
            //Return if an error occurs
            if(err) {
              done();
              console.error('error fetching client from pool', err);
              res.send(503, {code: 503, message: 'Service Unavailable', description: 'Error fetching client from pool. Try again later'});
              return next();
            }

            if(result.rowCount != 1){
              done();
              res.send(400, {code: 400, message: 'Bad Request', description: 'Accept-Language header. Invalid language' + array});
              return next();
            }

            //querying database
            var sql = 'INSERT INTO geo_object.continent VALUES ('+"'"+ uuid.v4() +"'"+', false, ';
              sql += "'" + req.body.code + "', '" + req.body.name + "', ";
              if(!!req.body.description){
                sql += "'" + req.body.description + "', ";
              }else{
                sql += "' ', ";
              }
              if(!!req.body.comment){
                sql += "'" + req.body.comment + "', ";
              }else{
                sql += "' ', ";
              }
              sql += "'" + languagesArray[0] + "')";

            //console.log(sql);

            client.query(sql, function(err, result) {
              done();
              //Return if an error occurs
              if(err) {//falta de conexion
                console.error('error fetching client from pool', err);
                res.send(503, {code: 503, message: 'Service Unavailable', description: 'Error fetching client from pool. Try again later'});
                return next();
              }
              res.header('Location', 'http://'+config.host+':' + config.port + '/continents/' + req.body.code);
              res.send(201);
            });
          });
        });
      }); //cierra connect
    }//cierra funcion
);  


/************************* UPDATE *************************/
/*
When the PUT request is accepted and processed by the service, 
the consumer will receive either a 200 OK response or a 204 No Content response.

200  with a response body is more descriptive and actively confirms the server-side state, 
while 204 is more efficient since it returns no representation and indicates that the server has accepted the request representation verbatim.

If a request has failed because of incompatible state. 
To signal conflicting state to the client, the service responds with a 409 Conflict status code.

In keeping with the HTTP specification, the response body includes enough information for the client to understand and 
potentially fix the problem, if at all possible.

500 Internal Server Error response code is equally straight-forward when using PUT simply wait and retry.
*/

/*Create a new continent (code and locale)*/
server.put(
    {path: '/continents/:code', version:'1.0.0'},
    function(req,res,next){

      if(!req.body){
        res.send(409, {code: 409, message: 'Conflict', description: 'Empty body'});
        return next();
      }

      pg.connect(conString, function(err, client, done){

        //Return if an error occurs
        if(err) {
          done();
          console.error('error fetching client from pool', err);
          res.send(500, {code: 500, message: 'Internal Server Error', description: 'Error fetching client from pool. Try again later'});
          return next();
        }

      //req.body = JSON.parse(req.body); //habilitar esta linea si el cliente envia un string y no un JSON

        //querying database
        var sql = 'UPDATE geo_object.continent SET ';
          if(!!req.body.name){ //It has a name
            sql += "name='" + req.body.name + "',";
          }
          if(!!req.body.description){ //It has a description
            sql += "description='" + req.body.description + "',";
          }
          if(!!req.body.comment){ //It has a comment
            sql += "comment='" + req.body.comment + "',";
          }
          sql = sql.substring(0, sql.length - 1);
            sql += " WHERE code='" + req.params.code + "'";
        //console.log(sql);

        client.query(sql, function(err, result) {
          done();
          //Return if an error occurs
          if(err) { //falta de conexion
            console.error('error fetching client from pool', err);
            res.send(500, {code: 500, message: 'Internal Server Error', description: 'Error fetching client from pool. Try again later'});
            return next();
          }
          if (result.rowCount == 0) {
            console.error('not found', err);
            res.send(404, {code: 404, message: 'Not Found', description: 'Update something that does not exist'});
            return next();
          }else{
            res.send(204);
          }
        });
      });
    }
);

server.listen(config.port);
console.log("GeoObject Listening on port: " + config.port + " Host: " +config.host);