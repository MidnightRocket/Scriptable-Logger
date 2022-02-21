# Scriptable-Logger
A scriptable module for managing logs for all your scriptable scripts!
Use this module to easily log errors and warnings to a file. This is very handy when developing a widget or automated script (eg. run with iOS Shortcuts) , where you can't log output to a console. 

This Logger module, acts as a wrapper around the console object. This means that you can simply substitute the console object, with a Logger object. Like this:
```js
logger.log("This is a log");
```
This would automatically be saved in an internal log file which can be [exported](#exporting-logs), whilst still be written to the console as if `console.log` was called. [See usage](#usage)

Logger uses an internal log file system, where logs are saved **temporarily** (by default 7 days, but can be changed. [See Usage](#usage)). **The logs must then be exported**, to be accessible and for permanent storage. [See Exporting logs](#exporting-logs)

## Download
First of all download [Logger.js](Logger.js) and save it in Scriptable. Either download the file and copy it to the scriptable folder in iCloud, or simply copy the code into a new script. 

You can also [directly import Logger.js](https://open.scriptable.app/run/Import-Script?url=https://github.com/MidnightRocket/Scriptable-Logger/blob/main/Logger.js) into Scriptable, if you have the [Import-Script by supermamon](https://github.com/supermamon/scriptable-scripts/tree/master/Import-Script). 


## Cheat sheet
The Cheat sheet below, provides some simple examples of how one would use Logger. 
```js
let Logger = importModule("Logger.js");
let logger = new Logger(); //Create Logger object, with default setttings. Logs saved under the same name as the script

logger.log("This is a log"); //Also printed to console, as if console.log was called
logger.warn("This is a warning"); //Also printed to console in orange, as if console.warn was called
logger.error("This is an error"); //Also printed to console in red, as if console.error was called
logger.dump(html, "The loaded webpage", ".html") //Save an .html file, with html as content with the logs. 

//Export logs. Note that the return value is a promise, which fulfills when the export is done. 
logger.exportLogs(); //Interactive export
logger.exportLogs(false); //Non-interactive export to "iCloud/Scriptable/Logger Exports/name"
logger.exportLogs(false, undefined, true); 
//Non-interactive export to "iCloud/Scriptable/Logger Exports/name", 
//where emojis are used to differentiate between log types. 
```
When you run Logger.js directly, will there be an interface for managing all internal logs. Here are you able to both export logs or delete logs. 
# Usage
First import the Logger.js module into your script.
```js
let Logger = importModule("Logger.js");
```

Then create a Logger object
```js
let logger = new Logger();
```
The constructor also takes 3 optional arguments, if you want to customize the behavior of the Logger object.
```js
let logger = new Logger(name, writeTypes, daysToKeep);
//name defaults to the name of the script
//writeTypes defaults to ["log", "warn", "error"]. That is all log "types".
//daysToKeep defaults to 7
```
`name` specifies which name to save the logs as.\
`writeTypes` defines which log "types" to save. If you only want to save errors that are logged (eg. `logger.error("Some error")`), then you would pass `["error"]`.\
`dayToKeep` specifies how many days of internal logs should be kept. It is best to keep this number low, and export logs often, rather than relying on the internal log system for long term storage. [See Exporting logs](#exporting-logs). 


## Logging logs
Once you have created a Logger object, you can simply just use it in place of the console object. The things you log, will be printed to the console like normal, but at the same time saved, for later [export](#exporting-logs). 
```js
logger.log("This will be logged and printed to console, as if console.log was called");
logger.warn("This will be logged and printed in orange in the console, as if console.warn was called");
logger.error("This will be logged and printed in red in the console, as if... You get the idea");
```


### Additional logging methods
Logger includes two additional methods for logging. 
The first one is very simple:
```js
-drop(Error);
```
This method logs the Error, and then throws the Error. 

The second one is very powerful:
```js
-dump(content, message, fileExtension);
```
This can be used to save file dumps, like html from a request, in conjunction with a notice in the log. Dumps will be exported along side all the logs, when a export is performed. [See Exporting logs](#exporting-logs). \
`content` is some text, like html from a request which you want to save. \
`message` defualts to `""`. It is some text, which will be written to console, and in the log next to reference to the file dump. \
`fileExtension` defaults to `".txt"`. This is the filextension the file dump will be given. \


## Exporting logs
When you want to export logs, you simply call the `-exportLogs`. 
```js
-exportLogs(interactive, exportPath, emojify);
```
Return value is a promise, which resolves with the resulting export path, when the export is done. \
`interactive` defaults to `true`. Whether or not the export process should be interactive. \
`exportPath` defaults to `undefined`. When `exportPath` is `undefined`, then logs will be exported to `"iCloud/Scriptable/Logger Exports/name"`, if iCloud is enabled. If not the promise will reject with an Error, unless in interactive mode. In interactive mode, the user will be promted to choose a location or use the default location in iCloud. When a path, which does not point to a directory is provided, then the promise will be rejected, regardless of interactiveness \
`emojify` defaults to `false`. Whether or not there should be used emojis to differentiate between the different log types. This can be used to more easily identify the different log types, as the text in the exported logs are not colored, unlike in the console.
- log = ✉️
- warn = ⚠️
- error = ‼️
- dump = 📦

