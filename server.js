/*****************  Quotinator Bot  ********************
*
*  Pick a random tweet
*  From within it pick a random word
*  Put that word in quotes and quote-retweet the original tweet with the "word"
*  Inspired by https://mobile.twitter.com/texttheater/status/941050750750351361
*    #botidea: replies to random tweets with a random word from that tweet but in quotes
*  Can't reply without opt-in per Twitter ToS
*
*******************************************************/

/* Setting things up. */
var fs = require('fs'),
    path = require('path'),
    express = require('express'),
    app = express(),   
    Twit = require('twit'),
    config = {
      twitter: {
        consumer_key: process.env.TESTING_CKEY,
        consumer_secret: process.env.TESTING_CSECRET,
        access_token: process.env.TESTING_ATOKEN,
        access_token_secret: process.env.TESTING_ASECRET
      }
    },
    T = new Twit(config.twitter),
    stream = T.stream('statuses/sample');

//  may use some of this later
var bot_responses = [
  "I am awake!",
  "I'm awake!",
  "I dozed off.",
  "I dozed off, but I am awake now!",
  "I dozed off, but I'm awake now!"
];

function random_from_array(arr){
  return arr[Math.floor(Math.random()*arr.length)]; 
}

app.use(express.static('public'));

app.all('/test/:input', function( req, resp ) {
  var newStr = decodeURIComponent( req.params.input );
  var trivialWords = [ 'a', 'an', 'the', 'of', 'at', 'in', 'to', 'at', 'with' ];
  var newStr = removeSubstringsInArray( newStr, trivialWords );
  resp.status(200).send( newStr );
});

app.all('/get-tweet/:id', function( req, resp ) {
  T.get('statuses/show/' + req.params.id, function( err, data, response ) {
    console.log( data );
  });
  resp.status(200).send( '' );
});

/* You can use uptimerobot.com or a similar site to hit your /tweet endpoint to wake up your app and make your Twitter bot tweet. */
app.all("/stream", function (request, response) {
  stream.on('tweet', function (tweet) {
    console.log(tweet)
  })
});

app.all("/tweet", function (request, response) {
  
  //  I don't think we actually need this with the API endpoint we're using
  fs.readFile(__dirname + '/last_checked_id.txt', 'utf8', function (err, last_checked_id) {

    var trivialWords = [ 'a', 'an', 'the', 'of', 'at', 'in', 'to', 'at', 'with' ];

    //  using count: 1 means we'll allow Twitter to pick a "random" tweet
    T.get('search/tweets', { q: '! OR :) OR :( filter:safe -filter:retweets -filter:quotes -filter:links -filter:media', since_id: last_checked_id, lang: 'en', count: 1, tweet_mode: 'extended' }, function(err, data, response) {
      if (err){
        console.log('Search error!', err);
        return false;
      }

      if ( data.statuses.length ) {

        data.statuses.forEach( function( status ) {
          console.log( status.full_text );
          var statText = removeAtMentions( status.full_text );
          statText = removeSubstringsInArray( statText, trivialWords );
          var quotableWord = pickRandomWord( statText );
          console.log( quotableWord );
          
          if ( statText.includes( '...' ) || status.truncated ) {
              console.log( status );
          }

          T.post('statuses/update', {
            status: '"' + quotableWord + '" https://twitter.com/statuses/' + status.id_str,
            quoted_status_id_str: status.id_str,
            in_reply_to_status_id: status.id_str,
            is_quote_status: true,
            quoted_status: status
          }, function(err, data, response) {
            if (err){
                /* TODO: Proper error handling? 
                */
              console.log('Retweet error!', err);
            }
            else{
              fs.writeFile(__dirname + '/last_checked_id.txt', status.id_str, 'utf8', function (err) {
                if (err) {
                /* TODO: Error handling? */
                  console.log('File writing error!', err);
                }
              });
            }
          });
        });
      } else {
        /* No new mentions since the last time we checked. */
        console.log('No new mentions...');      
      }

    });
  });

  /* TODO: Handle proper responses based on whether the tweets succeed, using Promises. For now, let's just return a success message no matter what. */
  response.sendStatus(200);
});

function removeAtMentions( input ) {

  return input.replace( /@\w*/gi, '');
  
}

function removeSubstringsInArray( input, arrayOfStrings ) {
  
  if( arrayOfStrings.length == 0 || !Array.isArray( arrayOfStrings ) ) {
    return input;
  }
  
  //  this is sloppy (lowercases the return string, only vaguely handles word-boundaries) 
  //  but it's good enough for my purposes
  return removeSubstringsInArray( input.toLowerCase().replace( arrayOfStrings.pop().toLowerCase() + ' ', '' ), arrayOfStrings );
  
}

function pickRandomWord( input ) {
  var inArray = input.split( ' ' );
  var randomIndex = Math.floor( Math.random() * inArray.length );
  return inArray[randomIndex];
}

var listener = app.listen(process.env.PORT, function () {
  console.log('Your bot is running on port ' + listener.address().port);
});