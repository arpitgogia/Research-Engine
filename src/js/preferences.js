(function() {
    var allPageDisplay = null;
    // add element to the custom blacklist 
    //TODO: check if element is already there before adding. 
    var add = function(type, content) {
        var tab = document.getElementById("blacklist_tbl")
        var row = tab.insertRow()
        var stringCell = row.insertCell()
        stringCell.innerHTML = content ? content : "Type your text here"
        stringCell.contentEditable = true
        stringCell.setAttribute("placeholder", "Add a site...");

        var typeCell = row.insertCell()
        var selectCell = document.createElement('select');
        selectCell.innerHTML = '<option value="REGEX">all URLs containing this text</option>'
        selectCell.value = type

        typeCell.appendChild(selectCell);

        var enabledCell = row.insertCell()
        enabledCell.innerHTML = "<input type='checkbox' checked></input>"
        var deleteThisCell = document.createElement("a");
        deleteThisCell.classList = ["delete"];
        deleteThisCell.innerHTML = "Delete"
        deleteThisCell.onclick = function(e) {
            var r = e.target.parentElement.parentElement
            r.parentNode.removeChild(r);
        }
        enabledCell.appendChild(deleteThisCell);

    }


    document.getElementById("restart_text").onclick = restartPlugin
    
    function restartPlugin(){
          chrome.runtime.reload()
        };


    function cutString(stringToCut) {
        if (stringToCut.length == 0)
            return "<em>No title</em>"
        if (stringToCut.length <= 50)
            return stringToCut
        return stringToCut.slice(0, 50) + "..."
    }

    function addHistoricPages(pages) {
        console.log(pages);
        var history_table = document.getElementById("history_tbl");
        for(var i = 0 ; i < pages.length ; i++) {
            var thisRow = document.createElement("tr")
            var colOne = document.createElement("td")
            colOne.innerText =  cutString(pages[i].title) 
            var colTwo = document.createElement("td")
            colTwo.innerHTML = cutString(pages[i].url).link(pages[i].url)
            thisRow.appendChild(colOne)
            thisRow.appendChild(colTwo)
            var deletePage = document.createElement("td")
            var deleteButton = document.createElement("a")
            deleteButton.classList = ["delete"];
            deleteButton.innerHTML = "Delete"
            deleteButton.onclick = function(e) {
                var r = e.target.parentElement.parentElement
                chrome.storage.local.remove(r.id)
                notie.alert(4, "Page deleted.", 2)
                r.parentNode.removeChild(r)
            }
            deletePage.appendChild(deleteButton)
            thisRow.appendChild(deletePage)
            thisRow.id = pages[i].time;
            history_table.appendChild(thisRow)
        }
    }

    function getHistory(text="") {
        var query = makeQueryFromText(text);
        query.text = text;
        if (query.before !== false && query.after !== false && query.after >= query.before) return;
        query.keywords.sort(function(a,b){return b.length-a.length});

        if (query.after >= CUTOFF_DATE) {
            var start = Math.floor(binarySearch(preloaded, {'time':+query.after}, LT_OBJ,
                                                GT_OBJ, 0, preloaded.length));
            var end;
            if (query.before) {
                end = Math.ceil(binarySearch(preloaded, {'time':+query.before}, LT_OBJ,
                                             GT_OBJ, 0, preloaded.length));
            } else {
                end = preloaded.length;
            }
            suggest(query, preloaded.slice(start, end))
        } else {
            var start = Math.floor(binarySearch(timeIndex, +query.after, LT,
                                                GT, 0, timeIndex.length));
            var end;
            if (query.before) {
                end = Math.ceil(binarySearch(timeIndex, +query.before, LT,
                                             GT, 0, timeIndex.length));
            } else {
                end = timeIndex.length;
            }

            window.sorted = [];
            var get = timeIndex.slice(start, end);
            var index = Math.ceil(binarySearch(get, +CUTOFF_DATE, LT, GT, 0, get.length));
            if (index < get.length) {
                sorted = preloaded.slice(0, get.length - index + 1);
            }
            get = get.slice(0,index);

            chrome.storage.local.get(get, function(items) {
                for (var key in items) {
                    sorted.push(items[key]);
                }
                sorted.sort(function(a,b) {return a.time - b.time});
                suggest(query, sorted);
            });
        }
    }
    function suggest(query, candidates) {
        var results = [];
        var urls = {};
        var keywords = query.keywords;
        var keywordsLen = keywords.length;
        var negative = query.negative;
        var negativeLen = negative.length;
        var j = 0;
        for (var i = candidates.length - 1; i > -1; i--) {
            var text = candidates[i].text;
            var isMatching = true;
            for (var k = 0; k < negativeLen; k++) {
                if (text.indexOf(negative[k]) > -1) {
                    isMatching = false;
                }
            }

            if (isMatching) {
                for (var k = 0; k < keywordsLen; k++) {
                    if (text.indexOf(keywords[k]) === -1) {
                        isMatching = false;
                        break;
                    }
                }

                if (isMatching) {
                    var cleanedURL = cleanURL(candidates[i].url);
                    if (!(cleanedURL in urls)) {
                        results.push(candidates[i]);
                        urls[cleanedURL] = true;
                        j += 1;
                        if (j === 6) {
                            break;
                        }
                    }
                }
            }
        }
        addHistoricPages(results);
    }

    function* nextPages(allPages){
        // console.log(allPages);
        while(true)
            yield allPages.splice(0, 20)
    }

    chrome.storage.local.get('blacklist', function(result) {
        var bl = result.blacklist
        if (Object.keys(bl).length > 0 && (bl['REGEX'].length > 0)) {
            var tab = document.getElementById("blacklist_tbl")
            var fields = ["REGEX"]
            for (var j = 0; j < fields.length; j++) {
                for (var i = 0; i < bl[fields[j]].length; i++) {
                    add(fields[j], bl[fields[j]][i])
                }
            }
        } else {
            add("REGEX", "login");
            add("REGEX", "Login");
            add("REGEX", "paypal.com");
            add("REGEX", "chrome-ui://newtab");
            save(false);
        }
    });

    function save(showAlert) {
        var showAlert = (typeof showAlert !== 'undefined') ?  showAlert : true;
        if (showAlert) { notie.alert(4, "Saved Preferences.", 2); }
        var tab = document.getElementById("blacklist_tbl");
        var indices = [];
        for (var i = 1; i < tab.rows.length; i++) {
            var row = tab.rows[i]
            if (row.cells[0].innerText === "") {
                indices.push(i)
            }
        }

        for (var j = indices.length-1; j > -1; j--) {
            tab.deleteRow(indices[j]);
        }



        if (tab.rows.length == 1) {
            chrome.runtime.sendMessage({
                "msg": 'setBlacklist',
                "blacklist": []
            });
            add("SITE", "");
        } else {
            var b = {
                'SITE': [],
                'PAGE': [],
                'REGEX': []
            }
            for(var i = 1; i < tab.rows.length; i++) {
                b[tab.rows[i].cells[1].childNodes[0].value].push(tab.rows[i].cells[0].innerText)
            }

            chrome.runtime.sendMessage({
                "msg": 'setBlacklist',
                "blacklist": b
            })
        }
    }

    function loadMore() {
        addHistoricPages(allPageDisplay.next().value)
    }

    function clearAllData() {
        chrome.storage.local.clear();
        localStorage.removeItem('list_downloaded_urls')
        notie.alert(1, 'Deleted All Data. Restarting WorldBrain...', 2)
        setTimeout(function() {
            chrome.runtime.reload()
        }, 2000);
    }

    function clearRules() {
        chrome.storage.local.get(['blacklist'], function(items) {
            var blacklist = items['blacklist'];
            blacklist['SITE'] = ['chrome-ui://newtab']
            chrome.storage.local.set({'blacklist':blacklist});
        });
        notie.alert(1, 'Deleted Rules. Restarting WorldBrain...', 2)
        setTimeout(function() {
            chrome.runtime.reload()
        }, 2000);
    }

    function clearHistory() {
        chrome.storage.local.get(function(results) {
            var timestaps = results['index']['index'];
            for(key in timestaps){
                chrome.storage.local.remove(timestaps[key]);
            }
            chrome.storage.local.set({'index':{'index':[]}});
        });
        notie.alert(1, 'Deleted History. Restarting WorldBrain...', 2)
        setTimeout(function() {
            chrome.runtime.reload()
        }, 2000);
    }

    // getHistory()

    document.getElementById("save").onclick = save;
    document.getElementById("add").onclick = add;
    document.getElementById("loadmore").onclick = loadMore;

    document.getElementById("clear").onclick = function () {
        notie.confirm('Are you sure you want to do that?', 'Yes', 'Cancel', function() {
            clearAllData();
        });
    }

    document.getElementById("clear-rules").onclick = function () {
        notie.confirm('Are you sure you want to do that?', 'Yes', 'Cancel', function() {
            clearRules();
        });
    }

    document.getElementById("clear-history").onclick = function () {
        notie.confirm('Are you sure you want to do that?', 'Yes', 'Cancel', function() {
            clearHistory();
        });
    }

    document.getElementById("search_history").onkeyup = function () {
        getHistory(document.getElementById("search_history").value);
    };

})();