var phantom = require('phantom');
var Q = require('q');
var fs = require('fs');
var cheerio = require('cheerio');
var fl = require('firstline');
var prependFile = require('prepend-file');

var url = 'http://mugshots.newsherald.com';
var resultsFile = 'collected.txt';
var results = [];
var first;
var _ph, _page, _outObj;
checkFile()

phantom.create([], { logLevel: 'error' }).then(ph => {
    _ph = ph;
    return _ph.createPage();
}).then(page => {
    _page = page;
    return _page.open(url);
}).then(() => {
    return _page.property('content');
}).then(content => {
	return gatherPage(content);
}).catch(err => console.log(err));

function gatherPage(content) {
    let $ = cheerio.load(content);
    
//    console.log('Scraping data!')
    // gather needed mugshot data and store in global results
    $('.itemLink').each(function(i) {
        let name = $(this).find('.MugshotsName').text().trim().replace(/\W+/g," ");
        let link  = $(this).attr('href');
        let result = '<' + link + '>' + name;
        
        if (!first) {
        	fs.appendFile(resultsFile,result + '\n', (err) => {if (err) {throw err}})
        } else {
        	if (first === result) {
        		console.log('Updating finished!');
        		_page.close();
        		_ph.exit();
        		process.exit();
        	} else {
        		prependFile(resultsFile, result + '\n', (err) => {if (err) {throw err}})
        	}
        }
        
        results.push(result);
    })
    // load next page
    checkPage().then((res) => {
    	if (res) {
    		console.log('Scraping finished!');
    		_page.close();
    		_ph.exit();
    		process.exit();
    	} else {
    		return nextPage()
    	}
    })
}

function checkFile() {
    fs.access(resultsFile, err => {
    	if (err) {
    		console.log('No collection file found!');
    		first = false
    	} else {
    		fl(resultsFile).then((res) => {
    			if (!first) {
    				first = res
    			}
    		})
    	}
    })
}

function checkPage() {
	return promise = new Promise(function(resolve, reject) {
		let res =_page.evaluate(function() {
			return document.getElementById('ContentPlaceHolder1_lblTotalPages').textContent
		})
		let res2 = _page.evaluate(function() {
			return document.getElementById('ContentPlaceHolder1_ddlPaging').value
		})
		return Promise.all([res, res2]).then(([res, res2]) => {
			console.log('Scraping page: ' + res2 + ' of: ' + res)
			if (res === res2) {
				resolve(true)
			} else {
				resolve(false)
			}
		})
	})
}

function nextPage() {
	// load next page, ensuring state
//	console.log('Running next page!')
	_page.evaluate(function() {
		 document.getElementById('ContentPlaceHolder1_lbtnNext').click();
	}).then(() => {
		return Q.delay(50);
	}).then(() => {
		return waitState(textPopulated)
	})
}

function retrieveLast() {
	return promise = new Promise(function(resolve, reject) {
		let content = _page.property('content').then((content) => {
			let $ = cheerio.load(content)
			let name = $('.itemLink').last().find('.MugshotsName').text().trim().replace(/\W+/g," ");
			let link  = $('.itemLink').last().attr('href');
	    
	    	resolve(res = '<' + link + '>' + name)
		})
	})
}

function doesSpanExist() {
	let exist = _page.evaluate(function () {
		return document.getElementById('ContentPlaceHolder1_lblTotalPages').textContent
	})
	if (exist && typeof exist !== 'null') {
		return true
	} else {
		return false
	}
}

function textPopulated() {
	return promise = new Promise(function (resolve, reject) {
	    retrieveLast().then((res) => {
	        if (res !== results[results.length - 1] && typeof res !== 'undefined') {
	        	if (doesSpanExist()) {
	        		resolve(true)
	        	} else {
	        		resolve(false)
	        	}
	        } else {
	    		resolve(false)
        	}
	    })
	})
}

function waitState(state, timeout) {  // timeout in seconds is optional
    var limitTime = timeout * 1000 || 15000;
    var startTime = new Date();
    
//    console.log('Awaiting state!')
    
    return wait();

    function wait() {
       state().then((res) => {
    	   if (res) {
 //          		console.log('Reached state!');
           		return Q.delay(250).then(() => {
           			return _page.property('content')
           		}).then((content) => {
           			return gatherPage(content)
           		})
       		} else if (new Date() - startTime > limitTime) {
    	   		throw new Error('Timed out!');
       		} else {
       			return Q.delay(1000).then(() => {
       				return wait();
       			})
       		}
       	})
    }
}