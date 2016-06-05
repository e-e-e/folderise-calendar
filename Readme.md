# folderise-calendar

A plugin for folderise used to incorporate google calendar into static site.

This was written to serve the 10 latest events on a google calendar. It is quite idiosyncratic as it was developed for \*\*frontyard\*\* project's [website](www.frontyardprojects.org). It need a lot of work to be more modular. 

## usage

To activate plugin add the following to the folderise settings.json

```json
"plugins": [ {
	"name": "folderise-calendar",
	"options": {
		"calendar":"your.account@gmail.com",
		"credentials":"./path/to/your/client_secret.json"
	}
}]
```

To include list of calander events on any pages add: 

```
{{@calendar}}
```