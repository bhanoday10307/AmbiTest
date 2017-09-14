# Ambi Test - NodeJS

A NodeJS module to rewrite multiple files with various asyncronous tasks/calls created in series and parallel, using callbacks.

Copyright (c) Bhanoday Puram, 2017

## Contact

**Name:** Bhanoday Puram

**Email:** bhanoday10307@gmail.com

**Phone:** 6812859456

## User Guide
**Local Copy**  - To get a local copy, move to the parent directory you would like to hold this repository and clone the repository from your terminal as follows:

```
git clone git@github.com:bhanoday10307/AmbiTest.git
```

To test the module, first import the module into your file/module. then using the reference of the imported module, call the method rewriteFiles() passing an array of filenames as the reference. make sure all the files are within the current directory as the module.

**For example:**
```
const fr = require('./rewriteFiles.js');

fr.rewriteFiles(["readMe.txt", "readMe2.txt"])
```

Or copy the contents of the module into an online compiler such as [Codepad](https://codepad.remoteinterview.io/) or
[Repl.it](https://repl.it/languages/javascript).

## Design 

* I solved the problem with events and event callbacks.
* Initially I tried solving this using streams in Node. But I was unable to stream from a file to itself. So switched to solving it with reading and writing on the files.
* Then, the major crux of the problem is with how to asynchronously read line by line from a file and in parallel process and write to the same file.
* To solve that, I have used the events module of Node to create a custom event called `line` and emitted it whenever the next() method of the ReadFileAsync class is called.
* I extended the EventEmitter class from events module to create custom event called `line`. whenever the `next()` method is called on ReadFileAsync class, I make sure that the buffer has the next line of text from the file and then emit the `line` event passing the line of text as input to the event handler.
* As the entire rewriting of one file is within the callback function to opening the file, All the files asyncronously are rewritten using the for loop to open each.
* To replace the text within double quotes in the given line, I have created a function `processLine` which takes in the line of string as input traces over the line finding pairs of double quotes and reversing & replacing the text within them.
* I wired this `processLine` method to the `line` event callback to process the line. when this processing is done just write it back to the file at the same pointer.
* Also I used two pointers, one to track the reading text from the file into the buffer, and the other to track the writing into the file.

## Algorithm - (Psuedo Code)

* I loop over the list of files and open them in 'r+' mode which enables to both read and write to the file. and as a callback to the open method, I pass in the `rewriteFile` method. which initiates the rewriting by calling next() on the instances of ReadFileAsync class for all the files asyncronously.
* Now with each file, whenever the next() is called, the buffer if empty, reloads by reading from the file, and traces the next line in the buffer to be processed and emits the `line` event.
* When the `line` event fires the callback is fired which gets the line of string to reverse the stings enclosed within double quotes. and writes the line of text back to the file. once it writes back successfully, It calls the next() method again and steps 2, 3 gets repeated(unless the end of file is reached).