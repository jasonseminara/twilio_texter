'use strict'
var twilio = require('twilio');
var request = require('request');
var parseString = require('xml2js').parseString;
var CronJob = require('cron').CronJob;
var async = require('async');

var client = twilio( process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTHTOKEN);
var openWeatherKey = process.env.OPENWEATHER_KEY;
var desiredLine = process.env.WATCHED_TRAIN;
var userFirstName = process.env.USER_NAME;
var userZip = process.env.USER_ZIP;



function cleanData(obj) {
  Object.keys(obj).forEach( key => obj[key]=obj[key][0] );
  return obj;
}


/*Create a new promise for the MTA Info*/
var getMTAInfo = new Promise( function(resolve, reject) { 
  var trainData="";
  request.get( 'http://web.mta.info/status/serviceStatus.txt' )
    .on('error',reject)
    .on('data', data=>trainData+=data )
    
    .on('end', ()=>{
      parseString( trainData , (err,result)=>{
        
        if(err) reject(err);
        
        var parsedTrains = result.service.subway[0].line
          .filter( (train) => train.name[0] === '123' )
          .map( cleanData )
        
        // finish the promise
        resolve(parsedTrains)
      })
    })
}); 

/*Create a new promise for the Weather Info*/
var getWeather = new Promise( function(resolve,reject){
  var completeWeather='';

  var qs = {
    zip:userZip,
    units:'imperial',
    appid:openWeatherKey
  };

  request.get({url:'http://api.openweathermap.org/data/2.5/weather',qs:qs})
    .on('error',reject)  
    .on('data', data=>completeWeather+=data )

    /* finish the promise*/
    .on('end', ()=> 
      resolve( JSON.parse(completeWeather) )
    )
});


var getAllData = function(){
  /*Do the last step when they're both done*/
  Promise.all( [getMTAInfo,getWeather] )
    .then( data=>{
        var myTrain = data[0];
        var myWeather = data[1];
        var myMessage = 'Good Morning '+userFirstName+',\n\nCurrent Temp: '+myWeather.main.temp+'°F\n\n'+myTrain[0].name+' Status:\n'+myTrain[0].status;
        client.sendMessage({
            to: process.env.PERSONAL_NUMBER,
            from: process.env.TWILIO_NUMBER,
            body: myMessage
          }, 
          (err,data)=>err ? console.log('error:', err) : console.log('data:', data);
        )
      }, 
      err=>console.log('bad',err) 
    )
}

var job = new CronJob('00 30 07 * * 1-5', getAllData)
job.start();