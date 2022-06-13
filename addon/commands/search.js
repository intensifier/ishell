import {settings} from "../settings.js";
import {NAMESPACE_SEARCH} from "./namespaces.js";

let maxSearchResults = settings.max_search_results() || 10;

CmdUtils.makeSearchCommand({
    name: "google",
    uuid: "61A61D85-07B4-4375-AB42-D635190241EA",
    url: `https://customsearch.googleapis.com/customsearch/v1?key=${cmdAPI.settings.google_cse_api_key}`
        + `&cx=${cmdAPI.settings.google_cse_api_id}&q=%s`,
    _namespace: NAMESPACE_SEARCH,
    icon: "/ui/icons/google.png",
    description: "Searches Google for your words.",
    arguments: [{role: "object", nountype: noun_arb_text, label: "query"}],
    previewDelay: 1000,
    help: "You can use the keyboard shortcut ctrl + alt + number to open one " +
          "of the Google results shown in the preview.",
    parser: {
        type       : "json",
        container  : "items",
        href       : "link",
        title      : "title",
        body       : "htmlSnippet",
        maxResults : maxSearchResults,
    },
    execute: function({object: {text}}) {
        if (text)
            CmdUtils.addTab(`http://www.google.com/search?q=${encodeURIComponent(text)}`);
    }
});

// CmdUtils.makeSearchCommand({
//     name: "bing",
//     uuid: "44FF357D-C3C2-4CB3-91EB-B4E415DC9905",
//     url: "http://www.bing.com/search?q=%s",
//     defaultUrl: "http://www.bing.com/",
//     _namespace: NAMESPACE_SEARCH,
//     _hidden: true,
//     arguments: [{role: "object", nountype: noun_arb_text, label: "query"}],
//     previewDelay: 1000,
//     icon: "/ui/icons/bing.png",
//     parser: {
//         container: ".b_algo",
//         title: "h2 > a",
//         body: ".b_caption",
//         maxResults: maxSearchResults,
//     },
// });

CmdUtils.makeSearchCommand({
    name: "IMDb",
    uuid: "F34E6A8C-FBBD-4DB2-9999-1B653034D985",
    url: "http://www.imdb.com/find?q=%s",
    defaultUrl: "http://www.imdb.com",
    _namespace: NAMESPACE_SEARCH,
    arguments: [{role: "object", nountype: noun_arb_text, label: "query"}],
    previewDelay: 1000,
    icon: "/ui/icons/imdb.png",
    parser: {
        container  : ".findResult",
        title      : ".result_text",
        thumbnail  : ".primary_photo",
        maxResults : maxSearchResults,
    },
});

CmdUtils.makeSearchCommand({
    names: ["YouTube"],
    uuid: "223E9F19-1DD8-4725-B09C-86EA5DE44DB0",
    url: ("http://www.youtube.com/results?search_type=search_videos" +
        "&search=Search&search_sort=relevance&search_query={QUERY}"),
    icon: "/ui/icons/youtube.png",
    description: ("Searches YouTube for videos matching your words. Previews the top results."),
    _namespace: NAMESPACE_SEARCH,
    arguments: [{role: "object", nountype: noun_arb_text, label: "query"}],
    previewDelay: 1000,
    preview: function(pblock, {object: {text, summary}}) {
        if (!text) return void this.previewDefault(pblock);

        pblock.text("Searches YouTube for " + text + ".", {it: summary.bold()});
        CmdUtils.previewAjax(pblock, {
            url: "https://www.googleapis.com/youtube/v3/search",
            data: {
                part: "snippet", type: "video", q: text, maxResults: maxSearchResults,
                key: cmdAPI.settings.youtube_search_api_key || "AIzaSyD0NFadBBZ8qJmWMmNknyxeI0EmIalWVeI",
            },
            dataType: "json",
            success: function youtube_success(data) {
                pblock.innerHTML =
                    `<div class="search-result-list">
                       <p>
                         Found <b>${data.pageInfo.totalResults}</b> YouTube Videos matching <b>${summary}</b>
                       </p>
                       ${R(data.items, (entry, entry_index) => 
                         `<div style="clear: both; font-size: small" class="search-result-item">
                           <kbd>${(entry_index < 35) ? (entry_index + 1).toString(36) : "-"}</kbd>.
                           <a style="font-size: small; font-weight:bold"
                              accessKey="${(entry_index < 35) ? (entry_index + 1).toString(36) : "-"}"
                              href="https://www.youtube.com/watch?v=${entry.id.videoId}">
                             <img style="float:left; margin: 0 10px 5px 0; border: none"
                                  src="${entry.snippet.thumbnails.default.url}" />
                             ${entry.snippet.title}
                           </a>
                           <p>
                             ${entry.snippet.description}
                           </p>
                          </div>`)}
                       </div>
                    `;
            },
            error: function youtube_error({statusText}) {
                pblock.innerHTML =
                    "<p class=error>" + Utils.escapeHtml(statusText);
            },
        });
    },
});

CmdUtils.makeSearchCommand({
    name: "images",
    uuid: "3A1A73F1-C651-4AD5-B4B4-2FBAAB85CDD0",
    arguments: [{role: "object", nountype: noun_arb_text, label: "query"}],
    _namespace: NAMESPACE_SEARCH,
    previewDelay: 1000,
    author: {name: "Federico Parodi", email: "getimages@jimmy2k.it"},
    contributor: "satyr",
    homepage: "http://www.jimmy2k.it/getimagescommand",
    license: "MPL",
    icon: "/ui/icons/google.png",
    description: "Browse pictures from Google Images.",
    url: "https://www.google.com/search?tbm=isch&q={QUERY}",
    preview: function gi_preview(pblock, {object: {text: q}}) {
        if (!q) return void this.previewDefault(pblock)

        pblock.innerHTML = "..."
        var data    = {q, start: 0, key: cmdAPI.settings.google_cse_api_key,
            cx: cmdAPI.settings.google_cse_api_id, searchType: "image"}
            , starts  = []
            , options = {
            data,
            url: "https://customsearch.googleapis.com/customsearch/v1",
            error: xhr => {
                pblock.text(`<em class=error>${xhr.status} ${xhr.statusText}</em>`);
            },
            success: (json, status, xhr) => {

                var images = [], info;

                json.items.forEach(item => {
                    let a = document.createElement("a");
                    a.setAttribute("href", item.link);
                    let img = document.createElement("img");
                    img.src = item.link;
                    a.appendChild(img);
                    images.push(a);
                });

                var i = 0
                for (let a of images) {
                    a.id = i;
                    if (i < 32)
                        a.accessKey = String.fromCharCode("a".charCodeAt() + i)
                    let img = a.children[0]
                    ++i
                }

                const range = images.length
                    ? `${data.start + 1} ~ ${data.start + images.length}`
                    : 'x';

                info = info ? info.outerHTML : '';

                pblock.innerHTML =
                    `<style>
                        .navi, .thumbs {text-align: center}
                        .prev, .next {position: absolute}
                        .navi {font-weight: bold}
                        .prev {left:  0}
                        .next {right: 0}
                        .thumbs a {
                          display: inline-block; vertical-align: top; position: relative;
                          margin: 0 1px 2px; padding: 0;
                        }
                        .thumbs a::after {
                          content: attr(accesskey);
                          position: absolute; top: 0; left: 0;
                          padding: 0 4px 2px 3px; border-bottom-right-radius: 6px;
                          opacity: 0.5; color: #fff; background-color: #000;
                          font:bold medium monospace;
                        }
                        img {
                            max-width: 150px;
                            max-height: 150px;
                        }
                     </style>
                     <div class="navi">
                       ${range}
                       <input type="button" class="prev" value="&lt;" accesskey="&lt;"/>
                       <input type="button" class="next" value="&gt;" accesskey="&gt;"/>
                     </div>
                     <!--div class="info">${info}</div-->
                     <div class="thumbs">${R(images.map(a => a.outerHTML),h => h)}</div>
                    `;

                if (!data.start)
                    pblock.querySelector(".prev").disabled = true

                pblock.querySelector(".navi").addEventListener("click", e => {
                    var b = e.target
                    if (b.type !== "button") return
                    e.preventDefault()
                    b.disabled = true
                    if (b.value === "<")
                        data.start = starts.pop() || 0
                    else {
                        starts.push(data.start)
                        data.start += images.length
                    }
                    CmdUtils.previewAjax(pblock, options)
                })

            },
        }
        CmdUtils.previewAjax(pblock, options)
    }
});

const ARTICLE_ERROR = _("Error retrieving summary");

function fetchWikipediaArticle(previewBlock, articleTitle, langCode) {
    var apiUrl = "http://" + langCode + ".wikipedia.org/w/api.php";
    var apiParams = {
        format: "json",
        action: "parse",
        page: articleTitle
    };

    CmdUtils.previewAjax(previewBlock, {
        type: "GET",
        url: apiUrl,
        data: apiParams,
        dataType: "json",
        error: function() {
            previewBlock.innerHTML = "<p class='error'>" + ARTICLE_ERROR + "</p>";
        },
        success: function(responseData) {
            //remove relative <img>s beforehand to suppress
            //the "No chrome package registered for ..." message
            var parse = jQuery(("<div>" + responseData.parse.text["*"])
                .replace(/<img src="\/[^>]+>/g, ""));
            //take only the text from summary because links won't work either way
            var articleSummary = parse.find("p:first").text();
            //remove citations [3], [citation needed], etc.
            articleSummary = articleSummary.replace(/\[.+?\]/g, "");
            //TODO: also remove audio links (.audiolink & .audiolinkinfo)
            //TODO: remove "may refer to" summaries
            var articleImageSrc = (parse.find(".infobox img").attr("src") ||
                parse.find(".thumbimage") .attr("src") || "");
            if (articleImageSrc && articleImageSrc.startsWith("//"))
                articleImageSrc = "https:" + articleImageSrc;
            previewBlock.innerHTML =
                (articleImageSrc &&
                    '<img src="'+ H(articleImageSrc) +'" class="thumbnail"/>') +
                H(articleSummary);
        }
    });
}

CmdUtils.CreateCommand({
    names: ["wikipedia"],
    uuid: "2622CD51-A5D8-4116-8907-06965CFAD53B",
    argument: [
        {role: "object", nountype: noun_arb_text, label: "search term"},
        {role: "format", nountype: noun_type_lang_wikipedia}],
    _namespace: NAMESPACE_SEARCH,
    previewDelay: 1000,
    homepage: "http://theunfocused.net/moz/ubiquity/verbs/",
    author: {name: "Blair McBride", email: "blair@theunfocused.net"},
    contributors: ["Viktor Pyatkovka"],
    license: "MPL",
    icon: "/ui/icons/wikipedia.ico",
    description: "Searches Wikipedia for your words, in a given language.",
    preview: function wikipedia_preview(previewBlock, args) {
        var searchText = args.object?.text?.trim();
        var lang = args.format.html || "English";
        if (!searchText) {
            previewBlock.text(`Searches Wikipedia in ${lang}.`);
            return;
        }
        var previewData = {query: args.object.html};
        previewBlock.text("Searching Wikipedia for <b>" + args.object.text + "</b> ...");
        var apiParams = {
            format: "json",
            action: "query",
            list: "search",
            srlimit: maxSearchResults,
            srwhat: "text",
            srsearch: searchText
        };

        function onerror() {
            previewBlock.innerHTML =
                "<p class='error'>" + _("Error searching Wikipedia") + "</p>";
        }

        var langCode = "en";
        if (args.format && args.format.data)
            langCode = args.format.data;

        var apiUrl = "http://" + langCode + ".wikipedia.org/w/api.php";

        CmdUtils.previewAjax(previewBlock, {
            type: "GET",
            url: apiUrl,
            data: apiParams,
            dataType: "json",
            error: onerror,
            success: function wikipedia_success(searchResponse) {
                if (!("query" in searchResponse && "search" in searchResponse.query)) {
                    onerror();
                    return;
                }

                function generateWikipediaLink(title) {
                    return "http://" + langCode + ".wikipedia.org/wiki/" +
                        title.replace(/ /g, "_")
                }

                (previewData.results = searchResponse.query.search)
                    .forEach(function genKey(o, i) { o.key = i < 35 ? (i+1).toString(36) : "-"});
                previewData._MODIFIERS = {wikilink: generateWikipediaLink};
                previewData.foundMessage =
                    _("Wikipedia articles found matching <b>" + args.object.text + "</b>:");
                previewData.retrievingArticleSummary =
                    _("Retreiving article summary...");
                previewData.noArticlesFound = _("No articles found.");

                previewBlock.innerHTML =
                    `<style>
                        .wikipedia { margin: 0 }
                        .title { clear: left; margin-top: 0.4em }
                        .title a { font-weight: bold }
                        .key:after {content: ":"}
                        .summary { margin: 0.2em 0 0 1em; font-size: smaller }
                        .thumbnail {
                            float: left; max-width: 80px; max-height: 80px; background-color: white;
                            margin-right: 0.2em;
                        }
                    </style>
                    <dl class="wikipedia">
                        ${previewData.foundMessage}
                        ${previewData.results && previewData.results.length
                            ? R(previewData.results, article => 
                                `<dt class="title">
                                    <span class="key">${article.key}</span>
                                    <a href="${generateWikipediaLink(article.title)}" accesskey="${article.key}"
                                      >${article.title}</a>
                                 </dt>
                                 <dd class="summary" wikiarticle="${article.title}">
                                    <i>${previewData.retrievingArticleSummary}</i>
                                 </dd>`)
                            : `<p className='error'>${previewData.noArticlesFound}</p>`
                        }
                    </dl>`;

                jQuery("dd", previewBlock).each(function eachDD() {
                    var article = this.getAttribute("wikiarticle");
                    fetchWikipediaArticle(this, article, langCode);
                });
            }
        });
    },
    execute: function wikipedia_execute(args) {
        var lang = args.format.data || "en";
        var searchUrl = "http://" + lang + ".wikipedia.org/wiki/Special:Search";
        var searchParams = {search: args.object.text};
        Utils.openUrlInBrowser(searchUrl + Utils.paramsToString(searchParams));
    }
});

CmdUtils.CreateCommand({
    name: "maps",
    uuid: "161A4B18-F577-40B9-99DB-B689690E657A",
    arguments: [{role: "object", nountype: noun_arb_text, label: "location"}],
    _namespace: NAMESPACE_SEARCH,
    description: "Shows a location on the map.",
    icon: "/ui/icons/google.png",
    author: "rostok",
    previewDelay: 1000,
    preview: function(pblock, args) {
        if (!args.object?.text) {
            pblock.text("Show objects or routes on google maps.<p>syntax: <pre>\tmaps [place]\n\tmaps [start] to [finish]</pre>");
            return;
        }
        pblock.innerHTML = `
            <div class="mapouter">
                <div class="gmap_canvas">
                    <iframe width="546" height="507" id="gmap_canvas" src="https://maps.google.com/maps?q=`
            + encodeURIComponent(args.object.text) + `&t=&z=13&ie=UTF8&iwloc=&output=embed" 
                    frameborder="0" scrolling="no" marginheight="0" marginwidth="0"></iframe>
                </div>
            <style>
                .mapouter{overflow:hidden;text-align:right;height:507px;width:546px; margin-top: -3px; margin-left: -7px;}
                .gmap_canvas {overflow:hidden;background:none!important;height:507px;width:546px;}
            </style>
            </div>`;
    },
    execute: function(args) {
        CmdUtils.addTab("https://maps.google.com/maps?q=" + encodeURIComponent(args.object.text));
    }
});

const LIBGEN_HOST = "http://libgen.is/";
const LIBGEN_HOST2 = "http://libgen.io/";

var libgenSearch = {
    // derived from https://github.com/toddpress/Looky_Booky
    getBooks_: () => {},

    getJSONResults: function(pblock, q, getBooks) {
        this.getBooks_ = getBooks;
        CmdUtils.previewAjax(pblock, {
            url: q,
            error: () => {pblock.text("Search error.")},
            success: this.logResults_.bind(this),
            dataType: "html"
        });
    },

    logResults_: function (tab) {
        var //tab = e.target.responseText,
            rHtml = $.parseHTML(tab);
        var key, table;
        for(key in rHtml) {
            if(rHtml[key].nodeName == "TABLE") {
                if($(rHtml[key]).attr('class') == "c"){
                    table = $(rHtml[key])[0];
                }
            }
        }
        var bookObjs = this.tableToJSON_(table);
        this.getBooks_(bookObjs);
    },

    tableToJSON_: function(table) {
        let self = this;
        let data = [];
        let $rows = $(table).children("tbody").children("tr").not(":first");

        for (let i=0; i<$rows.length; i++){
            let $row = $($rows)[i];
            let $cols = $($row).children("td");
            let entry = new Object();
            entry.mirrors = [];
            for (let j=0;j<$cols.length; j++){
                switch(j) {
                    case 1:
                        entry.authors = $cols[j].innerText;
                        break;
                    case 2:
                        let greens = $($cols[j]).find("font[color='green']");
                        greens.each(function () {
                            let green = $(this);
                            if (green.text().indexOf("[") < 0)
                                green.remove();
                            else
                                green.attr("style", "font-size: 90%");
                        });

                        let fonts = $($cols[j]).find("font");
                        fonts.each(function () {
                            let font = $(this);
                            font.attr("color", "#45BCFF");
                        });

                        $($cols[j]).find("a:not([id])").remove();
                        let links = $($cols[j]).find("a[id]");
                        links.each(function () {
                            let link = $(this);
                            let href = link.attr("href");
                            link.attr("style", "color: #45BCFF");
                            link.attr("href", self._libgen_host + link.attr("href"));
                        });

                        entry.title = $cols[j].innerHTML
                            .replace("<br>", " ")
                            .replace(/<a/ig, "<span class='libgen'")
                            .replace(/<\/a>/ig, "</span>");
                        entry.link = links.get(0).href;
                        break;
                    case 4:
                        entry.year = $cols[j].innerText;
                        break;
                    case 8:
                        entry.extension = $cols[j].innerText;
                        break;
                    case 9:
                        entry.mirrors = $($cols[j]).find("a");
                        break;
                }
            }

            entry.details = "";

            if (entry.year)
                entry.details += entry.year + ", ";

            if (entry.extension)
                entry.details += entry.extension + ", ";

            if (entry.authors)
                entry.details += entry.authors;

            data.push(entry);
        }
        return data;
    }
};


CmdUtils.CreateCommand({
    name: "libgen",
    uuid: "25DB48B1-0FB6-49FC-8F38-728A1BAF7265",
    arguments: [{role: "object",     nountype: noun_arb_text, label: "text"},
        {role: "instrument", nountype: ["asc", "desc"], label: "sort mode"}, // with
        {role: "modifier",   nountype: ["year", "title", "author"], label: "order"}, // of
        {role: "cause",      nountype: ["25", "50", "100"], label: "amount"}, // by
        {role: "time",       nountype: ["libgen.is", "libgen.io"], label: "server"}, // at
    ],
    description: "Search Library Genesis",
    help:  `<span class="syntax">Syntax</span>
        <ul class="syntax">
            <li><b>libgen</b> [<i>filter</i>] [<b>of</b> <i>order</i>] [<b>with</b> <i>sort mode</i>] [<b>at</b> <i>server</i>] [<b>by</b> <i>amount</i>]</li>
        </ul>
        <span class="arguments">Arguments</span><br>
        <ul class="syntax">
            <li>- <i>filter</i> - arbitrary text, filters books by title or authors.</li>
        </ul>
        <ul class="syntax">
            <li>- <i>order</i> - {<b>title</b> | <b>author</b> | <b>year</b> }, specifies the column to order by.</li>
        </ul>
        <ul class="syntax">
            <li>- <i>sort mode</i> - {<b>asc</b> | <b>desc</b>}, specifies sort mode.</li>
        </ul>
        <ul class="syntax">
            <li>- <i>server</i> - {<b>libgen.is</b> | <b>libgen.io</b>}.</li>
        </ul>
        <ul class="syntax">
            <li>- <i>amount</i> - {<b>25</b> | <b>50</b> | <b>100</b> }, specifies the maximum amount of listed items.</li>
        </ul>
        <span class="arguments">Examples</span>
        <ul class="syntax">
            <li><b>libgen</b> <i>philosophical investigations</i> <b>of</b> <i>year</i> <b>by</b> <i>50</i> <b>at</b> <i>.io</i></li>
        </ul>`,
    author: "g/christensen",
    icon: "/ui/icons/libgen.ico",
    previewDelay: 1000,
    _namespace: NAMESPACE_SEARCH,
    _genQuery: function(args) {
        let sort_mode;
        if (args.instrument && args.instrument.text)
            sort_mode = args.instrument.text.toUpperCase();

        let order;
        if (args.modifier && args.modifier.text)
            order = args.modifier.text;

        let amount;
        if (args.cause && args.cause.text)
            amount = args.cause.text;

        let libgen_host = (args.time && args.time.text && args.time.text === "libgen.io")
            ? LIBGEN_HOST2
            : LIBGEN_HOST;

        let query = `${libgen_host}search.php?open=0&view=simple&column=def&req=${args.object.text}`;
        libgenSearch._libgen_host = libgen_host;

        if (order) {
            query += "&sort=" + order;

            if (sort_mode)
                query += "&sortmode=" + sort_mode;
            else {
                if (order === "year")
                    query += "&sortmode=DESC";
            }
        }

        if (amount)
            query += "&res=" + amount;

        return query;
    },
    preview: function(pblock, args, {Bin}) {
        pblock.text("Searching...");
        let a = this._genQuery(args);

        libgenSearch.getJSONResults(pblock, a, books => {
            if (!books || !books.length) {
                pblock.text("Not found.");
            }
            else {
                CmdUtils.previewList2(pblock, books, {
                    text: (b) => b.title,
                    subtext: (b) => b.details,
                    action: (b) =>  chrome.tabs.create({"url": b.link, active: false})
                });
            }
        });
    },
    execute: function(args, {Bin}) {
        chrome.tabs.create({"url": this._genQuery(args)});
    }
});


CmdUtils.CreateCommand({
    name: "scihub",
    uuid: "DC18FEB8-882E-4030-B1B9-F50721877779",
    arguments: [{role: "object", nountype: noun_arb_text, label: "title or doi"}],
    description: "Search articles on SCI-HUB",
    author: "g/christensen",
    icon: "/ui/icons/scihub.ico",
    previewDelay: 1000,
    _article: null,
    _namespace: NAMESPACE_SEARCH,
    preview: function(pblock, args, {Bin}) {
        pblock.text("Searching...");

        if (args.object && args.object.text)
            CmdUtils.previewAjax(pblock, {
                method: "POST",
                url: "https://sci-hub.se",
                data: {"sci-hub-plugin-check": "", "request": args.object.text},
                error: e => { pblock.text("Search error.") },
                success: data => {
                    if (data) {
                        Utils.parseHtml(data, doc => {
                            let article = doc.querySelector("#article #pdf");

                            if (article) {
                                this._article = article.src;

                                if (!this._article.startsWith("http")) {
                                    if (this._article.startsWith("//"))
                                        this._article = "https:" + this._article;
                                    else if (this._article.startsWith("/"))
                                        this._article = "https://sci-hub.se" + this._article;
                                }

                                let citation = doc.querySelector("#citation");

                                if (citation.textContent?.trim() === ".") {
                                    citation.innerHTML = "&lt;press &apos;Enter&apos; to open the document&gt;";
                                }

                                pblock.text(`<a style="color: #45BCFF" 
                                                   href="${this._article}">${citation.innerHTML}</a>`);
                            }
                            else
                                pblock.text("Not found.");
                        });
                    }
                    else
                        pblock.text("Error.");
                },
                dataType: "html"
            });
        else
            pblock.innerHTML = "";
    },
    execute: function(args, {Bin}) {
        if (this._article) {
            chrome.tabs.create({"url": this._article});
            this._article = null;
        }
    }
});
