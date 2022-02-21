// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: file-alt;
/*
github.com/MidnightRocket/Scriptable-Logger
MIT License (c) 2022 MidnightRocket

A module for managing all your logging needs, in all of your scriptable scripts!
*/
	
function createDateFormatter(pattern) {
	let dateFormatter = new DateFormatter();
	dateFormatter.dateFormat = pattern;
	return dateFormatter;
}

function parseDateAsNumber(dateString) {
	return Number(dateString.match(/^(\d{1,4})-(\d{2})-(\d{2})$/).slice(1,4).join(""));
}

FileManager.prototype.isDirectory_ = FileManager.prototype.isDirectory;
FileManager.prototype.isDirectory = function(string) {
	if (typeof string == "string") {
		return this.isDirectory_(string);
	} else {
		return false;
	}
}

function createAlert(title, message, addCancel, ...actions) {
	let alert = new Alert();
	alert.title = title;
	alert.message = message;
	if (addCancel) {alert.addCancelAction("Cancel");}
	actions.flat().forEach((item) => {
		if (item.startsWith("!")) {
			alert.addDestructiveAction(item.slice(1));
		} else if (item.startsWith(" !")) {
			alert.addAction(item.slice(1));
		} else {
			alert.addAction(item);
		}
	});
	return alert;
}

function createThreads(inputArray, func, threads = 2) {
	if (threads < 1) {
		throw new RangeError("'threads' must be at least 1.");
	}

	let thread = 0;
	let taskQueue = Array();
	inputArray.forEach(item => {
		thread = (thread < threads) ? thread : 0;
		taskQueue[thread] ??= Array();
		taskQueue[thread].push(item);
		thread++;
	});


	let cancelled = false;
	let cancelCallbacks = [];

	function taskParser(input, outputChain) {
		return new Promise((resolve, reject) => {
			if (!cancelled) {
				let promise = func(input);
				
				Promise.resolve(promise.promise ?? promise).then((result) => {
					outputChain.push(result);
					resolve(outputChain);
				}).catch(reject);
				
				if (promise.cancel != undefined) {
					cancelCallbacks.push(promise.cancel);
				}
			} else {
				reject(new Error("Cancelled"));
			}
		});
	}


	let promiseThreads = taskQueue.map((taskList) => {
		return taskList.reduce((chain, task) => {
			return chain.then((outputChain) => {
				return taskParser(task, outputChain);
			});
		}, Promise.resolve([]));
	});
	
	
	function cancel(){
		if (!cancelled) {
			cancelled = true;
			cancelCallbacks.forEach((f) => {f()});
		}
	}
	
	
	let promise = Promise.all(promiseThreads).then((result) => {
		let output = [];
		let thread = 0;
		try{
			while (result[thread][0] != undefined) {
				output.push(result[thread++].shift());
				thread = (thread < result.length) ? thread : 0;
			}
		} catch (error) {
			if (!(error instanceof TypeError)) {
				throw error;
			}
		}
		return Promise.resolve(output);
	}).catch((reason) => {
		cancel();
		return Promise.reject(reason);
	});
	
	promise.cancel = cancel;

	return promise;
}


class Logger {
	static proxyLogger = new Proxy(console, {
		get: function(target, prop, receiver) {
			switch (prop) {
				case "log":
				case "warn":
				case "error":
					return Reflect.get(...arguments);
					break;
				default:
					console.log("Proxy logger: " + prop);
					return function() {return Promise.resolve();}
			}
		}
	});
	
	static dateFormatter = createDateFormatter("yyyy-MM-dd");
	static lfm = FileManager.local(); //LocalFileManager
	static basePath = Logger.lfm.joinPath(Logger.lfm.documentsDirectory(), "/logger-data");


	static #promptDeletion(all, name) {
		return new Promise(function(resolve, reject){
			if (!config.runsInApp) {
				reject("This action can only be performed inside the app");
			} else {
				let prompt = new Alert();
				prompt.title = "Do you want to delete all logs from " + (all ? "all scripts?" : name + "?");
				prompt.message = "This action cannot be undone!";
				prompt.addCancelAction("Cancel");
				prompt.addDestructiveAction("Delete");
				prompt.presentAlert().then(resolve);
			}
		});
	}

	static deleteAllLogs() {
		return new Promise(function(resolve,reject){
			Logger.#promptDeletion(true, Script.name).then(response => {
				if (response == 0) {
					Logger.lfm.remove(Logger.basePath);
					resolve(0);
				} else {
					reject(new Error("User canceled"))
				}
			}).catch(reject);
		});
	}


	#name;
	#today;
	#subPath; //basePath + name
	#todayPath; //subPath + today
	#logsPath; //todayPath + '/logs'
	#writeTypes = ["dump"]; //Should all logs be written, or only warnings and errors.
	#daysToKeep; //Days to keep logs for


	get name() {return this.#name;}
	get today() {return this.#today;}
	get subPath() {return this.#subPath;}
	get todayPath() {return this.#todayPath;}
	get logsPath() {return this.#logsPath;}
	get writeTypes() {return this.#writeTypes;}
	get daysToKeep() {return this.#daysToKeep;}


	#millisecondsToKeep;
	#oldestDayToKeep;

	constructor(name = Script.name(), writeTypes = ["log", "warn", "error"], daysToKeep = 7) {
		this.#writeTypes = this.writeTypes.concat(writeTypes);
		this.#daysToKeep = daysToKeep;
		this.#name = name;
		this.#today = Logger.dateFormatter.string(new Date());
		this.#subPath = Logger.lfm.joinPath(Logger.basePath, this.name);
		this.#todayPath = Logger.lfm.joinPath(this.subPath, this.today);
		this.#logsPath = Logger.lfm.joinPath(this.todayPath, "/logs");

		this.#millisecondsToKeep = this.daysToKeep*24*60*60*1000;
		this.#oldestDayToKeep = Logger.#parseDateAsNumber(Logger.dateFormatter.string(new Date(Date.now()-this.#millisecondsToKeep)));

		if (!Logger.lfm.isDirectory(this.logsPath)) {
			//Logger.lfm.createDirectory(this.logsPath, true);
		} else {
			this.trim();
		}
	}


	#writeLog(message, type) {
		switch (type) {
			case "error":
			console.error(message);
			break;
			case "warn":
			console.warn(message);
			break;
			case "dump":
			case "log":
			default:
			console.log(message);
		}
		//console.log(this.writeTypes.includes(type));
			if (this.writeTypes.includes(type)) {
				if (!Logger.lfm.isDirectory(this.logsPath)) {
				Logger.lfm.createDirectory(this.logsPath, true);
			}
			
			let path = Logger.lfm.joinPath(this.logsPath, new Date().toISOString());
			while (Logger.lfm.fileExists(path)) {
				console.log("Log already exists, trying again...");
				path = Logger.lfm.joinPath(this.logsPath, new Date().toISOString());
			}
			
			try{
				Logger.lfm.writeString(path, String(message));
				Logger.lfm.writeExtendedAttribute(path, type, "type");
			} catch (error) {
				Logger.lfm.writeString(path, "Failed to write log:" + String(error));
				Logger.lfm.writeExtendedAttribute(path, "error", "type");
			}
		}
	}

	//https://stackoverflow.com/questions/56503531/what-is-a-good-way-to-automatically-bind-js-class-methods
	//bind this
	log = (message) => {
		this.#writeLog(message, "log");
	}

	warn = (message) => {
		this.#writeLog(message, "warn");
	}

	error = (errorMessage) => {
		if (errorMessage.line != undefined) {
			this.#writeLog("Error on line " + (errorMessage.line-1) + ": " + errorMessage.message, "error");
		} else {
			this.#writeLog(errorMessage, "error");
		}
	}

	drop = (errorObject) => {
		this.error(errorObject);
		throw errorObject;
	}

	dump = (content, message = "", fileExtension = ".txt") => {
		if (!fileExtension.startsWith(".") && fileExtension != "") {
			fileExtension = "." + fileExtension;
		}
		
		let date = new Date().toISOString();
		let path = Logger.lfm.joinPath(this.todayPath, "dump-" + date + fileExtension);
		while (Logger.lfm.fileExists(path)) {
			console.log("Dump already exists, trying again...");
			date = new Date().toISOString();
			path = Logger.lfm.joinPath(this.todayPath, "dump-" + date + fileExtension);
		}
		
		message = "(dump-" + date + fileExtension + "): " + message;
		this.#writeLog(message, "dump");
		Logger.lfm.writeString(path, content);
	}



	deleteLogs(showPrompt = true) {
		let self = this;
		return new Promise(function(resolve, reject){
			if (showPrompt) {
				Logger.#promptDeletion(false, self.name).then(response => {
					if (response == 0) {
						Logger.lfm.remove(self.subPath);
						resolve(0);
					} else {
// 						console.warn("User canceled");
						reject(Error("User cancelled"))
					}
				}).catch(reject);
			} else {
				try {
					Logger.lfm.remove(self.subPath);
				} catch (error) {
					reject(error)
				}
				resolve();
			}
		});

	}

	reinitialize() {
		if (!Logger.lfm.isDirectory(this.logsPath)) {
			Logger.lfm.createDirectory(this.logsPath, true);
		} else {
			console.warn("Already initialized!");
		}
	}

	static #parseDateAsNumber(dateString) {
		try {
			return Number(dateString.match(/^(\d{1,4})-(\d{2})-(\d{2})$/).slice(1,4).join(""));
		} catch (error) {
			return null;
		}
	}

	#getCurrentLogs() {
		let logsArray = Logger.lfm.listContents(this.subPath);

		let output = logsArray.filter((file) => {
			let fileAsNumber = Logger.#parseDateAsNumber(file);
			return fileAsNumber > this.#oldestDayToKeep && fileAsNumber != null;
		});

		return output;
	}

	#getOldLogs() {
		let logsArray = Logger.lfm.listContents(this.subPath);

		let output = logsArray.filter((file) => {
			let fileAsNumber = Logger.#parseDateAsNumber(file);
			return fileAsNumber <= this.#oldestDayToKeep && fileAsNumber != null;
		});

		return output;
	}


	trim() {
		//console.log(this.#getCurrentLogs());
		let oldLogs = this.#getOldLogs();
		oldLogs.forEach((file) => {
			Logger.lfm.remove(Logger.lfm.joinPath(this.subPath, file));
		});
	}
	

	exportLogs(interactive = true, exportPath = undefined, emojify = false) {
		let self = this;
		
		let defaultExportPath;
		let ifm;
		try {
			ifm = FileManager.iCloud();
			defaultExportPath = ifm.joinPath(ifm.documentsDirectory(), "/Logger Exports");
		} catch (error) {
			console.log("iCloud not enabled");
			defaultExportPath = undefined;
		}
		
		function reformatDate(string) {
			let dateFormatter = createDateFormatter("yyyy-mm-dd HH:mm:ss");
			return dateFormatter.string(new Date(string));
		}

		function parseLogType(string, emojify){
			let logTypeTable = {
				"emoji": {
					"log": "✉️",
					"warn": "⚠️",
					"error": "‼️",
					"dump": "📦"
				},
				"en": {
					"log": "L",
					"warn": "W",
					"error": "E",
					"dump": "D"
				}
			}
			return (logTypeTable[emojify ? "emoji" : "en"][string] ?? string) ?? "?";
		}
		

		function doExport(path) {
			let exportPath = Logger.lfm.joinPath(path, self.name);
			
			function processDayPaths(dayPath){
				let cancelled = false;
				let cancel = () => {
					cancelled = true;
				}
				
				let dayDirectory = Logger.lfm.joinPath(self.subPath, dayPath);
				
				let logsDirectory = Logger.lfm.joinPath(dayDirectory, "logs");
				
				let exportDayDirectory = Logger.lfm.joinPath(exportPath, dayPath);
				
				
				function processDump(dumpPath){
					let cancelled = false;
					let cancel = () => {
						cancelled = true;
					}
					let promise = new Promise((resolve, reject) => {
						resolve();
						if (cancelled) {
							reject(new Error("cancelled"));
						} else {
							let fromPath = Logger.lfm.joinPath(dayDirectory, dumpPath);
							let toPath = Logger.lfm.joinPath(exportDayDirectory, dumpPath);
							Logger.lfm.copy(fromPath, toPath);
							resolve();
						}
					});
					
					promise.cancel = cancel;
					
					return promise;
				}
				
				function processLog(logPath){
					let cancelled = false;
					let cancel = () => {
						cancelled = true;
					}
					let promise = new Promise((resolve, reject) => {
						if (cancelled) {
							reject(new Error("cancelled"));
						} else {
							let fullLogPath = Logger.lfm.joinPath(logsDirectory, logPath);
							
							let logContent = Logger.lfm.readString(fullLogPath);
							
							let logType = parseLogType(Logger.lfm.readExtendedAttribute(fullLogPath, "type"), emojify);
							
							let timeStamp = reformatDate(logPath);
							
							resolve(`${timeStamp}[${logType}]: ${logContent}`);
						}
					});
					
					promise.cancel = cancel;
					
					return promise;
				}
				
				
				let dumps = Logger.lfm.listContents(dayDirectory).filter((file) => {
					return file.startsWith("dump-", 0);
				});
				
				let logs = Logger.lfm.listContents(logsDirectory).sort();
		
				
				let promise = new Promise(async (resolve, reject) => {
					if (cancelled) {
						reject(new Error("cancelled"));
					} else if (logs.length != 0 || dumps.length != 0) {

						if (!Logger.lfm.isDirectory(exportDayDirectory)) {
							Logger.lfm.createDirectory(exportDayDirectory);
						}


						let promiseDumps = createThreads(dumps, processDump, 2);
						
						let processLogs = createThreads(logs, processLog, 2);
						
						processLogs.then((result) => {
							let fullLog = result.join("\n");
							let exportLogPath = Logger.lfm.joinPath(exportDayDirectory, "log.txt");
							Logger.lfm.writeString(exportLogPath, fullLog);
							return Promise.resolve();
						});
						
						cancel = (error) => {
							cancelled = true;
							promiseDumps.cancel();
							processLogs.cancel();
							reject(error);
						}
						
						
						Promise.all([promiseDumps]).then(resolve).catch(cancel);
					} else {
						resolve();
					}
				});
				
				promise.cancel = cancel;
				
				return promise;
			}
			
			return new Promise(async function(res, rej){
				if (defaultExportPath == path && !Logger.lfm.isDirectory(path)) {
					Logger.lfm.createDirectory(path)
				}
				
				if (!Logger.lfm.isDirectory(exportPath)) {
					Logger.lfm.createDirectory(exportPath);
				}
				
				let alreadyExportedLogs = Logger.lfm.listContents(exportPath);

				let pathsToCopy = self.#getCurrentLogs().filter((file) => {
					return (file == self.today || !alreadyExportedLogs.includes(file));
				});
				
				
				await createThreads(pathsToCopy, processDayPaths, 2).catch(rej);
				
				res(exportPath);
			});
		}

		function doInteractiveExport(path) {
			return new Promise(async function(res, rej){
				doExport(path).then(result => {
					Safari.open("shareddocuments://"+ encodeURI(result));
					res(result);
				}).catch(rej);
			});
		}


		return new Promise(async function(resolve, reject) {
			if (interactive) {
				if (!config.runsInApp) {
					reject(Error("Interactive export must run inside the app."));
				} else if (!Logger.lfm.isDirectory(exportPath) && exportPath != undefined) {
					reject(Error("Provided path is not a valid directory"));
				} else if (Logger.lfm.isDirectory(exportPath)) {
					//export to provieded path
					createAlert("Do you want to export logs?", "", true, "Export").presentAlert().then((res) => {
						if (res == -1) {
							reject("User cancelled");
						} else {
							resolve(doInteractiveExport(exportPath));
						}
					});
				} else {
					//show menu for export
					let actions = ["Select location"];
					if (defaultExportPath != undefined) {actions.push("Use default location")}
					
					createAlert("Do you want to export logs?", 
						"Do you want to export to default location in iCloud, or do want to select a location?", 
						true, ...actions).presentAlert().then((res) => {
						if (res == -1) {
							reject(Error("User cancelled"));
						} else if (res == 0) {
							resolve(DocumentPicker.openFolder().then(doInteractiveExport));
						} else {
							resolve(doInteractiveExport(defaultExportPath));
						}
					});
				}
			} else if (exportPath == undefined && defaultExportPath != undefined) {
				//export to icloud default
				resolve(doExport(defaultExportPath));
			} else if (Logger.lfm.isDirectory(exportPath)) {
				//export to provided path
				resolve(doExport(exportPath));
			} else if (!Logger.lfm.isDirectory(exportPath) && exportPath != undefined) {
				reject("Provided path is not a valid directory");
			} else {
				reject("No path provided. Either provide a path as parameter, or enable iCloud for default export path");
			}
		});
	}
}

module.exports = Logger;


const runsInScript = module.filename.endsWith("/" + Script.name() + ".js");
if (runsInScript) {
	await (async function() {
		await manageLogs();
	})();
}


async function manageLogs() {
	let alert = undefined;
	let subPaths = [];
	try {
		subPaths = Logger.lfm.listContents(Logger.basePath);
	} catch (e) {
		let error = new Error("There are no logs to manage");
		error.line = undefined;
		throw error;
	}
	console.log(subPaths);
	alert = createAlert("Which logs to export or delete?", undefined, true, ...subPaths, "!Delete All Logs");
	
	await alert.presentAlert().then((result) => {
		if (result == -1) {
			return Promise.reject(Error("User cancelled"));
		} else if (result == subPaths.length) {
			return Logger.deleteAllLogs();
		} else {
			let loggerObject = new Logger(subPaths[result]);
			alert = createAlert("What du want to do with: ", subPaths[result], true, "Export", "!Delete");
			return alert.presentAlert().then((result) => {
				if (result == -1) {
					return Promise.reject(Error("User cancelled"));
				} else if (result == 0) {
					return loggerObject.exportLogs(true, undefined, true);
				} else {
					return loggerObject.deleteLogs(true);
				}
			});
		}
	}).catch(console.log);
}
