/* jshint esnext:true, globalstrict:true */
/* global require, console, __dirname, process, exports, module */

"use strict";

var fs = require('fs');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
var Q = require('q');

var marked = require('marked');
marked.setOptions({ gfm:true,	breaks: true });
var escape_markdown = require('./markdown-escape.js');
var SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'folderise-calendar.json';

/*global exports:true*/
exports = module.exports = installCalendar;

function installCalendar (options) {
	return new Calendar(options);
}

function Calendar(options) {

	var calendar = google.calendar('v3');
	var calendar_name = options.calendar;
	var credentials = JSON.parse(fs.readFileSync(options.credentials));
	var oauth2Client = get_oauth2client();

	//returns a promise
	this.middleman = function (req,res) {
		console.log("PATH IS = " +req.path);
		if(req.path === '/OAuth2CalendarRedirect') {
			oauth2Client.getToken(req.query.code, function(err, token) {
				if (err) {
					console.log('Error while trying to retrieve access token', err);
					//res.send('api authorisation failed');
					return;
				}
				oauth2Client.credentials = token;
				storeToken(token);
				console.log('api authorised');
				return;
			});
		} else return;
	};

	this.execute = function() {
		return this.authorise()
			.then( listEvents )
			.then( response => {
				var events = response.items;
				if (events.length === 0) {
					return markdown_to_html('## No upcoming events found.');
				} else {
					var content = '## Upcoming \n\n';
					for (var i = 0; i < events.length; i++) {
						content += render_event(events[i]) + ' \n';
					}
					return markdown_to_html(content);
				}
			}).catch(err => {
				console.log('ERROR');
				console.log(err.message);
				console.log(err.stack);
				return err;
			});
	};

	this.authorise = function authorize() {
		var deferred = Q.defer();
	  // Check if we have previously stored a token.
	  fs.readFile(TOKEN_PATH, function(err, token) {
	    if (err) {
	      var authUrl = oauth2Client.generateAuthUrl({
					access_type: 'offline',
					approval_prompt: 'force',
					scope: SCOPES
				});
				//authorise this app by visiting this url.
				deferred.reject(`Not authorisation token - need to authorise at ${authUrl}`);
	    } else {
	      oauth2Client.credentials = JSON.parse(token);

	      deferred.resolve(oauth2Client);
			}
		});
		return deferred.promise;
	};
	
	// private functions

	function get_oauth2client() {
		var clientSecret = credentials.web.client_secret;
		var clientId = credentials.web.client_id;
		var redirectUrl = credentials.web.redirect_uris[0];
		var auth = new googleAuth();
		return new auth.OAuth2(clientId, clientSecret, redirectUrl);
	}

	function storeToken(token) {
		try {
			fs.mkdirSync(TOKEN_DIR);
		} catch (err) {
			if (err.code != 'EEXIST') {
				throw err;
			}
		}
		fs.writeFile(TOKEN_PATH, JSON.stringify(token));
		console.log('Token stored to ' + TOKEN_PATH);
	}

	function listEvents(auth) {
		var deferred = Q.defer();
		calendar.events.list({
				auth: auth,
				calendarId: calendar_name,
				timeMin: (new Date()).toISOString(),
				maxResults: 10,
				singleEvents: true,
				orderBy: 'startTime'
			}, (err, results) => {
				if(err) deferred.reject(err);
				else deferred.resolve(results);
			});
		return deferred.promise;
	}

	function render_event(event) {
		console.log(event);
		var options = {
			weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
			timezone:'Australia/Sydney'
		};
		var start = new Date(event.start.dateTime || event.start.date);
		var end = new Date(event.end.dateTime || event.end.date);
		var date = '';
		if((start.getMonth() !== end.getMonth()) || 
			 (start.getYear() !== end.getYear()) ||
			 (start.getDate() !== end.getDate()) ) {
				//multiple days
			date = start.toLocaleDateString('en-AU', options) +" "+ start.toLocaleTimeString('en-AU', {timezone:'Australia/Sydney'}) + ' – </br>' + end.toLocaleDateString('en-AU', options) + " " + end.toLocaleTimeString('en-AU', {timezone:'Australia/Sydney'});
		} else {
			//single day
			date = start.toLocaleDateString('en-AU', options) + '</br>'+start.toLocaleTimeString('en-AU', {timezone:'Australia/Sydney'}) + 
						" - " + end.toLocaleTimeString('en-AU', {timezone:'Australia/Sydney'});

		}
		var str = `- **${ escape_markdown(event.summary) }** </br>`;
		str += `\t *${date}* \n\n`;
		if( event.description ) 

			str += '>' + event.description.replace(/[\n\r]+/g,(match)=>match+'> ') + '\n\n';
		return str;
	}
}


function markdown_to_html (str,options) {
	var deferred = Q.defer();
	marked(str,options, deferred.makeNodeResolver());
	return deferred.promise;
}