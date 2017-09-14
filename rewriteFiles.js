'use strict'

/** Module Dependencies */
const fs = require("fs");
const events = require("events");

/** @constant - if line length in any of the files exceeds or equals BUF_SIZE, then next() will throw an Error.*/
const BUF_SIZE = 8092;

/** @exports - Exports the method rewriteFiles
 *  The rewrite accepts an array of files, and rewrites (if the file(s) exist) them asynchronously using the callback method rewriteFile().
 */
module.exports.rewriteFiles = function rewriteFiles(files){
	for(let i=0; i<files.length; i++) {
		function rewriteFile(err, fd) {
			if(err) {
				console.log(err);
			}
			else {
		    	let writePointer = 0;
				let fileReader = new ReadFileAsync(fd);
				fileReader.on("line", function (err, eof, line) {
				    if(err) console.log(err.toString());
				    else if(eof) console.log("End of file reached");
				    else {
						fs.write(fd, fileReader.processLine(line), writePointer, 'utf8', function(err, written, str){
							if(!err) {
								writePointer += written;
							}
							fileReader.next(); /** carry on stepping through file */
						});
				    }
				});
				fileReader.next(); /** get first line in the file */
			}
		}
		fs.open(files[i], 'r+', rewriteFile);
	}
}

/** @classdesc 
 *  ReadFileAsync class inherits from EventEmitter class
 *  ReadFileAsync class exposes the methods of processLine(), next(), and close().
 */
class ReadFileAsync extends events.EventEmitter {
	/** @constructor
	 *  The constructor of ReadFileAsync has the variables for monitoring the 
	 *  progress of the file read. 
	 */
	constructor(fd) {
		super(); 								/** to call the constructor of EventEmitter class*/
	    this._fd = fd; 							/** file descriptor */
	    this._buffer = new Buffer(BUF_SIZE); 	/** binay buffer to contain the text read from the file */
	    this._end = 0; 							/** index to point to the end of text in buffer */
	    this._pos = 0; 							/** index to point to the start of the unprocessed text in buffer */
	    this._eof = false; 						/** index to point to the end of first line in the unprocessed text in buffer */
	    this._reading = false; 					/** boolean to say if the file is being read */
	    this._readPointer = 0; 					/** to track and point the file text that is being read */
	}
	/** @method processLine takes in the line in the orginal line, reverses any strings withing double-quotes 
	 *  (say "abc" to "cba") and returns the reversed line 
	 */
	processLine(line) {
		/** get indices of initial pair(start and end) of double-quotes in the line (if exists) */
		let start = line.indexOf('"');
		let end = ((start > -1) && (start < line.length-1))?line.indexOf('"', start+1):-1;
		while((start > -1) && (end > start)) { /** if both start and end exist */
			let str = line.slice(start+1, end);
			str = str.split("").reverse().join(""); /** reverse str */
			line = line.substr(0, start+1) + str+line.substr(end, line.length-end);
			start = line.indexOf('"', end+1);
			end = ((start > -1) && (start < line.length-1))?line.indexOf('"', start+1):-1;
		}
		return line+'\n';
	}
	/** @method _refill() takes in a callback function, reads new text from the file 
	 *  (if eof is not reached), refills the buffer and on success calls the callback function
	 */
	_refill(callback) {
	    /** first move the lines (already processed) to the front of the buffer */
	    let i = 0;
	    while(this._pos < this._end) {
			this._buffer[i++] = this._buffer[this._pos++];
	    }
	    this._pos = 0;
	    this._end = i;

	    /** now refill the remainder of the buffer */
	    fs.read(this._fd,		  /** file descriptor */
		    this._buffer,         /** byte buffer */
		    this._end,            /** buffer position of start of load */
		    BUF_SIZE - this._end, /** max length of load */
		    this._readPointer,	  /** read offset in file */
		    callback);
	}
	/** @method _find_eol parses through the buffer to trace out the index end of line, ie '\n' and returns the 
	 *  index if found, otherwise returns end of buffer.
	 */
	_find_eol() {
	    let i = this._pos;
	    for(; i < this._end; ++i) {
			if(this._buffer[i] === 0xA) {// '\n'
			    break;
			}
	    }
	    return i;
	}
	_emit_line(eol) {
	    let begin = this._pos;
	    this._reading = false;
	    /** don't return an empty string representing the phantom output of */
	    /** the last line of the file with concluding '\n' */
	    if(this._eof === true && begin === eol) {
			this.emit("line", null, true, "");
			this.close();
	    }
	    else {
			this._pos = eol;
			++this._pos;
			if(eol && this._buffer[eol - 1] === 0xD) // '\r'
			    --eol;
			/** Emit via process.nextTick() to avoid excessive recursion on */
			/** next() calls where asynchronous _refill() isn't called */
			var self = this;
			let line = this._buffer.toString("utf8", begin, eol);
			process.nextTick(function () {
			    self.emit("line", null, false, line);
			});
	    }
	}
	/** @method next() - emits the 'line' event with the next line to be processed
	 *  
	 */
	next() {
	    /** check pre-conditions */
	    if(this._reading) { /** next() has been called outside the "line" event callback */
			this.emit("line", new Error("ReadFileAsync read operation already in course"), false, "");
			this.close();    /** also sets _reading to false */
			return;
	    }
	    if(this._eof) { /** if eof is reached */
			this.emit("line", null, true, "");
			this.close();
			return;
	    }
	    if(this._buffer === null) { /** if buffer is null */
			this.emit("line", new Error("ReadFileAsync file is closed"), false, "");
			return;
	    }
	    this._reading = true;
	    var self = this;
	    function loop() {
			var eol = self._find_eol();
			if(eol === self._end) {
			    if((self._pos === 0)&&(self._end === BUF_SIZE)) { /** If the eol was not found */
					/** line length has exceeded or equalled BUF_SIZE */
					self.emit("line", new Error("The file has a line larger than the buffer, consider increasing BUF_SIZE"), false, "");
					self.close();
			    }
			    else {
					self._refill(function (err, fetched) {
					    if(err) {
							self.emit("line", err, false, "");
							self.close();
					    }
					    else if(self._reading) {
							if(fetched  === 0) {  /** end-of-file */
							    self._eof = true;
							    self._emit_line(self._end);
							}
							else {
							    self._end += fetched;
							    self._readPointer += fetched;
							    loop(); /** loop to see if we have read enough bytes to find eol */
							}
					    }
					});
			    }
			}
			else {
			    self._emit_line(eol);
			}
	    } /** end of loop() function definition */
	    loop();  /** initiate loop */
	}
	/** @method close() - closes the file using the _fd reference */
	close() {
	    if(this._buffer !== null) {
			fs.close(this._fd);
			this._buffer = null;
			this._reading = false;
			/** go via event loop to allow a set of error/eof messages */
			/** before disconnecting listeners */
			var self = this;
			process.nextTick(function () {self.removeAllListeners();});
	    }
	}
}