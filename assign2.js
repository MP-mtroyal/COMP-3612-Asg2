
/** Morgan Payette
 *  Comp 3612
 * November 28th 2023
 * 
 * Attributions:
 *    CSS is powered by the BULMA CSS library with no outside Javascript
 *    https://bulma.io/
 * 
 *    Chart displays are powered by chart.js radar charts
 *    https://www.chartjs.org/
 * 
 *    All other attributions are included in the function discription where they are used.
 * 
 * 
 * All logos/icons are either created in Blender by me, or
 * AI generated using a local installation of Stable Diffusion 
 * distribution avaliable here
 * https://github.com/AUTOMATIC1111/stable-diffusion-webui
 */

/* url of song api --- https versions hopefully a little later this semester */	
const api = 'https://www.randyconnolly.com/funwebdev/3rd/api/music/songs-nested.php';

/**
 * Work around so that I can use ENUMs to avoid string compare runtime errors
 * This isn't typescript though :(
 * The solution was sorta found here, if you squint a little and stand far back
 * https://masteringjs.io/tutorials/fundamentals/enum
 */

class Page{
   static Home       = 'pageHome';
   static Search     = 'pageSearch';
   static Playlist   = 'pagePlaylist';
   static SingleSong = 'pageSingleSong';
}
class SortMode{
   static Title  = 'Title';
   static Artist = 'Artist';
   static Genre  = 'Genre';
   static Year   = 'Year';
}
class SearchMode{
   static Title  = 'title';
   static Artist = 'artist';
   static Genre  = 'genre';
   static None   = 'none';
}
//global values using these enums to preserve site state
let currentPage = Page.Home;
let currentSortMode = SortMode.Title;
let currentSearchMode  = SearchMode.Title;
let currentSearchValue = "";

/** ENTRY POINT
 * Main event listener to initally load the site after the DOM has loaded
 */
document.addEventListener("DOMContentLoaded", function(){
   //remove local storage item for testing API
   //window.localStorage.removeItem("Asg2Songs");
   hideAllPages();
   loadNewPage(currentPage);
});
/**
 * Sets the visibilty of the elements of a page
 */
function setPageVisibility(vis){
   let ele = document.querySelector(`#${currentPage}`);
   if (vis){ele.classList.remove('is-hidden');}
   else{ele.classList.add('is-hidden');}
}
/**
 * For creating an element, setting some of its parameters, and appending it to he parent
 * any parameters passed as null will not be set.
 * The tag to be created and the parent to append to are manditory
 * @param {*} tag     Manditory - Name of the tag for the element to be created
 * @param {*} parent  Manditory - Parent element that the new element will become the child of
 * @param {*} _text   Optional  - Text content of the new element 
 * @param {*} _class  Optional  - Class of the new element
 * @param {*} _id     Optional  - ID of the new element
 * @param {*} song_id Optional  - The song_id of the new element, stored in element.dataset.song_id
 * @returns The new element that was created
 */
function createAndAppendElement(tag, parent, _text=null, _class=null, _id=null, song_id=null){
   let ele = document.createElement(tag);
   if(_text != null){ele.textContent = _text;}
   if(_class != null){ele.className = _class;}
   if(_id != null){ele.id = _id;}
   if(song_id != null){ele.dataset.song_id = song_id;}
   parent.appendChild(ele);
   return ele;
}
/**
 * Sets all pages' visibility to hidden
 */
function hideAllPages(){
   const ids = [Page.Search, Page.Home, Page.Playlist, Page.SingleSong];
   for(let id of ids){
      let ele = document.querySelector(`#${id}`);
      ele.classList.add('is-hidden');
   }
}
/**
 * Makes the current page invisable, then sets the new page and loads it in
 * This function updates global variables
 * Progress bars are displayed while the page is loading
 * @param {*} page Page._____ Manditory - new Page to be loaded
 * @param {*} args Optional - optional arguments for some page changes. Will be passed through to the page's load function
 * @returns Promise of the loading page. For Promise functionality, see the particular load function in question
 */
function loadNewPage(page, args=null){
   setPageVisibility(false);
   currentPage = page;
   setPageVisibility(true);
   setProgressBarVisibility(true);
   let loadingPage;
   if(currentPage == Page.Home){loadingPage = loadHomePage();}
   else if(currentPage == Page.Search){loadingPage = loadSearchPage();}
   else if(currentPage == Page.Playlist){loadingPage = loadPlaylistPage();}
   else if(currentPage == Page.SingleSong){loadingPage = loadSingleSongPage(args);}
   return loadingPage.then(() => setProgressBarVisibility(false));
}
/**
 * Sets the visibility of the progress bars for the current page
 * @param {*} vis bool - the desired visibility of the progress bars
 */
function setProgressBarVisibility(vis){
   let query = "";
   if     (currentPage == Page.Home)      {query = '.homeProgress';}
   else if(currentPage == Page.Search)    {query = '.searchProgress';}
   else if(currentPage == Page.Playlist)  {query = '.playlistProgress';}
   else if(currentPage == Page.SingleSong){query = '.singleSongProgress';}
   let bars = document.querySelectorAll(query);
   for(let bar of bars){
      if(vis){bar.classList.remove('is-hidden');}
      else{bar.classList.add('is-hidden');}
   }
}
/**
 * Inserts into an ordered list, with highest value entries at the lowest index
 * If the item is the lowest value, it is appended to the end
 * @param {*} arr array to insert into
 * @param {*} item Item to be inserted
 * @param {*} f Function to access parameter used for sorting. Parameter assumed to be 
 *                able to evaluate on >
 */
function insertIntoOrderedArr(arr, item, f){
   for(let i=0; i<arr.length; i++){
      if(f(item) > f(arr[i])){
         arr.splice(i, 0, item);
         return;
      }
   }
   arr.push(item);
}

//---------------------- Home Page Functions   ---------------------------------------------------------
//For an on click event page switch
function homePageSwitch(){loadNewPage(Page.Home);}
/**
 * Loads the home pages
 * Calculates top genres, artists and songs
 *    For artists and genres, objects are made with the artist/genre as a key, and the number of occurances 
 * is the value. As the list is iterated, keys are added and incremented as needed
 *    After those objects are built, they are places into an ordered array of objects, each containing the 
 * key and whatever the count was. 
 *    The songs are able to be put straight into an ordered array, since their magnitude is known immedidately
 *    All ordered lists are then iterated through for 15 iterations (or less if they have less elements)
 * to populate their list with list items
 */
function loadHomePage(){
   return getSongs()
      .then((songs) => {
         let genreList  = document.querySelector('#homeGenresList');
         let artistList = document.querySelector('#homeArtistsList');
         let songsList  = document.querySelector('#homeSongsList');

         let genreCount  = {};
         let artistCount = {};
         
         let popularGenres   = [];
         let popularArtists  = [];
         let popularSongList = [];

         genreList.innerHTML  = "";
         artistList.innerHTML = "";
         songsList.innerHTML  = "";

         genreList.addEventListener('click', homeGenreHandler);
         artistList.addEventListener('click', homeArtistHandler);
         songsList.addEventListener('click', homePopularHandler);
         
         // Orgainze the data into counting objects or sorted arrays
         for(let song of songs){
            if(genreCount[song.genre.name]){genreCount[song.genre.name]++;}
            else{genreCount[song.genre.name] = 1;}
            if(artistCount[song.artist.name]){artistCount[song.artist.name]++;}
            else{artistCount[song.artist.name] = 1;}
            insertIntoOrderedArr(popularSongList, song, (s) => s.details.popularity);
         }
         //Organize counted genre object into sorted arry
         for(let [key, value] of Object.entries(genreCount)){
            insertIntoOrderedArr(popularGenres, {genre:key, count:value}, (g) => g.count);
         }
         //Create elements with sorted array
         for(let i=0; i<15; i++){
            createAndAppendElement('li', genreList, `${popularGenres[i].genre}`, "homeItem ml-4");
            if(popularGenres.length == i-1){break;} //boundary check
         }

         //Organize counted artist object into sorted array
         for(let [key, value] of Object.entries(artistCount)){
            insertIntoOrderedArr(popularArtists, {artist:key, count:value}, (a) => a.count);
         }
         //Create elements with sorted array
         for(let i=0; i<15; i++){
            createAndAppendElement('li', artistList, `${popularArtists[i].artist}`, "homeItem ml-4");
            if(popularArtists.length == i-1){break;} //boundary check
         }

         //Create elements with sorted array
         for(let i=0; i<15; i++){
            createAndAppendElement('li', songsList, `${popularSongList[i].title}`, "homeItem ml-4", null, popularSongList[i].song_id);
            if(popularSongList.length == i-1){break;} //boundary check
         }
      });
}
/**
 * Click handler for home genre list.
 * If the click is on a valid member of the genre list, the search page is loaded
 * with a search for that genre.
 * @param {*} e click event
 */
function homeGenreHandler(e){
   if(e.target.tagName != 'LI'){return;}
   currentSearchMode = SearchMode.Genre;
   currentSearchValue = e.target.textContent;
   let dropdown = document.querySelector('#genreInput');
   loadNewPage(Page.Search)
      .then(() => {
         for(let i=0; i<dropdown.options.length; i++){
            if(dropdown.options[i].textContent == e.target.textContent){
               dropdown.value = i;
               break;
            }
         }
      });
}
/**
 * Click handler for home artist list.
 * If the click is on a valid member of the artist list, the search page is loaded
 * with a search for that artist.
 * @param {*} e click event
 */
function homeArtistHandler(e){
   if(e.target.tagName != 'LI'){return;}
   currentSearchMode = SearchMode.Artist;
   currentSearchValue = e.target.textContent;
   let dropdown = document.querySelector('#artistInput');
   loadNewPage(Page.Search)
      .then(() => {
         for(let i=0; i<dropdown.options.length; i++){
            if(dropdown.options[i].textContent == e.target.textContent){
               dropdown.value = i;
               break;
            }
         }
      });
}
/**
 * Popular songs event handler.
 * If the click is on a valid member of the popular songs list,
 * the single song analytics page is loaded with that song displayed.
 * @param {*} e click event
 */
function homePopularHandler(e){
   if(e.target.tagName != 'LI'){return;}
   let id = e.target.dataset.song_id
   getSongs()
      .then((songs) => {
         let song = songs.find((s) => s.song_id == id);
         if(song != null){
            singleSongPageSwitch(song);
         }
      });
}
//---------------------End Home Page Functions --------------------------------------------------------

//--------------------- Search/Browse Page Functions -----------------------------------------------------
//For an onclick event to switch page
function searchPageSwitch(){loadNewPage(Page.Search);}
/**
 * Loads and initalizes the search page.
 * Populates search options and the browse table.
 * @returns Promise, pass through return of the runCurrentSearch function
 */
function loadSearchPage(){
   document.querySelector('#searchChoices').addEventListener('click', radioPress);
   populateOptions(document.querySelector('#artistInput'), (song) => song.artist.name);
   populateOptions(document.querySelector('#genreInput'), (song) => song.genre.name);

   document.querySelector('#browseLabels').addEventListener('click', sortingHandler);

   setActiveSearch(currentSearchMode);
   return runCurrentSearch();
}

/**
 * clears the song search selection, disables drop downs and deselects radios.
 * Populates the search results with an unfiltered songs list.
 */
function clearSelection(){
   currentSearchMode = SearchMode.None;
   let radios    = document.querySelectorAll(".searchRadio");
   for(let radio of radios){radio.checked = false;}
   let dropdowns = document.querySelectorAll(".searchDropdown");
   for(let dropdown of dropdowns){dropdown.disabled = true;}
   return populateSearchResults();
}
/**
 * filters the search results based on the current dropdown selection or text box input of the selected radio button.
 * takes a sort mode incase you want it sorted a specific way.
 */
function filterSelection(){
   let titleTextbox  = document.querySelector('#titleInput');
   let artistDropdown = document.querySelector('#artistInput');
   let genreDropdown  = document.querySelector('#genreInput');
   if(currentSearchMode == SearchMode.Title){
      currentSearchValue = titleTextbox.value;
   } else if(currentSearchMode == SearchMode.Artist){
      currentSearchValue = artistDropdown.options[artistDropdown.value].text;
   } else if(currentSearchMode == SearchMode.Genre){
      currentSearchValue = genreDropdown.options[genreDropdown.value].text;
   } else {
      currentSearchValue = "";
   }
   runCurrentSearch();
}
/**
 * 
 * @returns Promise, pass through from populateSearchResults
 */
function runCurrentSearch(){
   if(currentSearchMode == SearchMode.Title){
      return populateSearchResults((song) => song.title.toLowerCase().includes(currentSearchValue.toLowerCase()), currentSortMode);
   } else if (currentSearchMode == SearchMode.Artist){
      return populateSearchResults((song) => song.artist.name == currentSearchValue, currentSortMode);
   } else if (currentSearchMode == SearchMode.Genre){
      return populateSearchResults((song) => song.genre.name == currentSearchValue, currentSortMode);
   } else {
      return populateSearchResults(null, currentSortMode);
   }
}
/**
 * Radio button press handler
 * Enables or disabled the dropdown according to the state of the radio it is in conjunction with
 * radio buttons are assumed to have an ID with the format "radioXXXXXXXXX"
 * dropdowns are assumed to have the ID format XXXXXXXDropdown
 */
function radioPress(e){
   if(e.target.type != 'radio'){return;}
   
   let label = e.target.id.slice(5).toLowerCase();
   if(label != currentSearchMode){setActiveSearch(label);}
}
function setActiveSearch(searchMode){
   currentSearchMode = searchMode;
   showActiveSearch();
}
/**
 * Enables only the currently active search to be shown (based on global currentSearchMode)
 */
function showActiveSearch(){
   let radios = document.querySelectorAll(".searchRadio");
   for(let radio of radios){
      let label = radio.id.slice(5).toLowerCase();
      if(label == currentSearchMode){
         radio.checked = true;
         document.querySelector(`#${label}Input`).disabled = false;
      } else {
         radio.checked = false;
         document.querySelector(`#${label}Input`).disabled = true;
      }
   }
}
/**
 * Event delegation for all non-button objects in the search results area
 */
function searchResultsClicked(e){
   if(e.target.className == 'browseTitleEllipse'){
      //Ellipse clicked, show full title name
      displayFullTitle(e.target);
   } else {
      let id = e.target.dataset.song_id;
      //Show the song in single song view
      if(e.target.classList.contains("browseTitle")){
         getSongs()
            .then((songs) => {
               let song = songs.find((s) => s.song_id == id);
               if(song != null){
                  singleSongPageSwitch(song);
               }
            });
      //Sort the songs by the clicked artist
      } else if (e.target.classList.contains("browseGenre")){
         currentSearchValue = e.target.textContent;
         currentSearchMode  = SearchMode.Genre;
         runCurrentSearch();
      //Sort the songs by the clicked Genre
      } else if (e.target.classList.contains("browseArtist")){
         currentSearchValue = e.target.textContent;
         currentSearchMode  = SearchMode.Artist;
         runCurrentSearch();
      }
   }
}
/**
 * Populates the information columns with the appropriate song search results
 * @param filter optional: a function that defines how song objects should be filtered
 *                         expected to be a boolean returning function that takes a song object as input
 */
function populateSearchResults(filter=null){
   songList = document.querySelector('#browseList');
   songList.addEventListener('click', searchResultsClicked);
   songList.innerHTML = "";
   return getSongs()
      .then((songs) => {
         if(filter != null){songs = songs.filter(filter);}
         sortList(songs, currentSortMode);
         setCategoryArrows();
         for(let i=0; i<songs.length; i++){
            let row = createAndAppendElement('tr', songList, null, 'searchItem', `song${i}`);
            
            //If title is longer than 25 char, cut off with a ... and show full when the ... is clicked
            if(songs[i].title.length > 25){
               let titleHolder = createAndAppendElement('td', row, null, null, "browseTitleHolder");
               titleHolder = createAndAppendElement('div', titleHolder);
               createAndAppendElement('span', titleHolder, songs[i].title.slice(0, 24), "browseTitle", null, songs[i].song_id);
               let ellipse = createAndAppendElement('span', titleHolder, `…`, "browseTitleEllipse", null, songs[i].song_id);
               ellipse.dataset.full_title = songs[i].title;
            } else {
               createAndAppendElement('td', row, songs[i].title, "browseTitle", null, songs[i].song_id);
            }

            createAndAppendElement('td', row, songs[i].artist.name, "browseArtist", null, songs[i].song_id);
            createAndAppendElement('td', row, songs[i].year, "browseYear", null, songs[i].song_id);
            createAndAppendElement('td', row, songs[i].genre.name, "browseGenre", null, songs[i].song_id);
            let addBtn = createAndAppendElement('td', row, "Add", "browseAdd button is-primary m-1", null, songs[i].song_id)
            addBtn.addEventListener('click', addHandler);
         }
      });
}
/**
 * Event delegation for category titles
 * Sorts the list based on which title is clicked
 */
function sortingHandler(e){
   if(e.target.tagName != 'SPAN'){return;}
   setCategoryArrows();
   if      (e.target.textContent == SortMode.Title) {currentSortMode = SortMode.Title}
   else if (e.target.textContent == SortMode.Artist){currentSortMode = SortMode.Artist}
   else if (e.target.textContent == SortMode.Genre) {currentSortMode = SortMode.Genre}
   else if (e.target.textContent == SortMode.Year)  {currentSortMode = SortMode.Year}
   filterSelection();
}
/**
 * Sets the visability of category arrows based on the current mode for sorting.
 */
function setCategoryArrows(){
   let arrows = document.querySelectorAll('.categoryArrows');
   for(let arrow of arrows){
      if(arrow.dataset.sortmode == currentSortMode){arrow.classList.remove('is-hidden');}
      else {arrow.classList.add('is-hidden');}
   }
}

/**
 * Displays the full song name of one that is cut off when it's ellipse is clicked
 * @param {*} ellipseEle The ellipse element that was clicked
 */
function displayFullTitle(ellipseEle){showMessage(ellipseEle.dataset.full_title, ellipseEle.dataset.song_id, 3000);}
/**
 * Populates a dropdown menu with option elements with contents of songs based on specificed critera
 * The dropdown menu is populated with unique occurances of each parameter only, no duplicate
 * The dropdown is sorted into alphabetical order
 * @param {*} dropDown The dropdown menu to be populated
 * @param {*} f A function specifing the parameter to be populated.
 *                expected to take a song as input and return a parameter from that song.
 */
function populateOptions(dropDown, f){
   getSongs()
      .then((songs) => {
         let optionSet = new Set();
         for(let song of songs){optionSet.add(f(song));}
         optionArray = [...optionSet].sort((x,y) => x.localeCompare(y));
         let i=0;
         for(let option of optionArray){
            let ele = createAndAppendElement('option', dropDown, option);
            ele.value = i;
            i++;
         }
      })
}
/**
 * Click handler for playlist add functionality. 
 * Adds a song to the playlist based on the song_id of the clicked element.
 * @param {*} e click event
 */
function addHandler(e){
   let id = e.target.dataset.song_id
   getSongs()
      .then((songs) => {
         let song = songs.find((s) => s.song_id == id);
         if(song != null){
            addToPlaylist(song);
            displayPlaylistInfo();
            showMessage(`Added "${song.title}" to your playlist :)`, id);
         }
      });
}

//---------------- Search/Browse Functions end -------------------------------------------------------------

//---------------- Playlist Functions ---------------------------------------------------------------------
//page switch to the playlist page
function playlistPageSwitch(){loadNewPage(Page.Playlist);}
/**
 * Retrieves the playlist from local storage. 
 * If one is not found, an empty playlist is created and added to localstroage
 * @returns Playlist - An array of song objects
 */
function getPlaylist(){
   let playlist = window.localStorage.getItem("Asg2Playlist");
   if(playlist == null){
      playlist = [];
      window.localStorage.setItem("Asg2Playlist", JSON.stringify(playlist));
   }
   return JSON.parse(playlist);
}
/**
 * Adds a song to playlist and saves that to local storage
 * @param {*} song song object to be added to the playlist
 */
function addToPlaylist(song){
   let playlist = getPlaylist();
   let songOccurance = playlist.find((s) => s.title == song.title);
   if(songOccurance == null){
      playlist.push(song);
      window.localStorage.setItem("Asg2Playlist", JSON.stringify(playlist));
   }
}
/**
 * removes a song from the playlist and saves over local storage.
 * @param {*} song song object to be removed from the playlist
 */
function removeFromPlaylist(song){
   let playlist = getPlaylist();
   for(let i=0; i<playlist.length; i++){
      if(playlist[i].song_id == song.song_id){
         playlist.splice(i, 1);
         window.localStorage.setItem("Asg2Playlist", JSON.stringify(playlist));
         return;
      }
   }
}
/**
 * Removes all songs from the playlist and saves over local storage.
 */
function clearPlaylist(){
   window.localStorage.setItem("Asg2Playlist", JSON.stringify([]));
   loadPlaylistPage();
   showMessage("Your playlist has been cleared", 'clear_playlist');
}
/**
 * Loads the playlist page and initalizes its values.
 */
function loadPlaylistPage(){
   let playlist = getPlaylist();
   let songList = document.querySelector('#playlistEntries');
   songList.addEventListener('click', playlistHandler);
   songList.innerHTML = "";
   for(let song of playlist){
      let row = createAndAppendElement('tr', songList, null, 'playListItem', `playlistItem_${song.song_id}`, song.song_id);
      createAndAppendElement('td', row, song.title, null, null, song.song_id);
      createAndAppendElement('td', row, song.artist.name, null, null, song.song_id);
      createAndAppendElement('td', row, song.year, null, null, song.song_id);
      createAndAppendElement('td', row, song.genre.name, null, null, song.song_id);
      createAndAppendElement('td', row, song.details.popularity, null, null, song.song_id);
      let rmvBtn = createAndAppendElement('td', row, 'Remove', 'playlistRemove button is-primary m-1', null, song.song_id);
      rmvBtn.addEventListener('click', removeHandler);
   }
   displayPlaylistInfo();
}
/**
 * Event delgation for clicks inside the playlist.
 * If a song  is clicked, shows single song view for that song
 * @param {*} e click event
 * @returns 
 */
function playlistHandler(e){
   if(e.target.tagName != 'TD'){return;}
   if(e.target.classList.contains('playlistRemove')){return;}
   let id = e.target.dataset.song_id;
   getSongs()
      .then((songs) => {
         let song = songs.find((s) => s.song_id == id);
         if(song != null){
            singleSongPageSwitch(song);
         }
      });
}
/**
 * Click handler for removing from playlist.
 * Removes a song from playlist in memory, removes HTML elements accociated with 
 * the song, and displays a message saying what happened.
 * @param {*} e click event
 */
function removeHandler(e){
   let id = e.target.dataset.song_id;
   getSongs()
      .then((songs) => {
         let song = songs.find((s) => s.song_id == id);
         if(song != null){
            removeFromPlaylist(song);
            let row = document.querySelector(`#playlistItem_${id}`);
            row.remove();
            displayPlaylistInfo();
            showMessage(`"${song.title}" was removed from your playlist :(`, song.song_id);
         }
      });
}
/**
 * Updates the information about the playlist based on the current songs
 * in that playlist.
 */
function displayPlaylistInfo(){
   let countEle = document.querySelector('#songCount');
   let avgEle   = document.querySelector('#avgPopularity');
   let playlist = getPlaylist();
   let songCount = playlist.length;
   let popularitySum = 0;
   for(let song of playlist){popularitySum += song.details.popularity;}
   countEle.textContent =  `Playlist Song Count: ${songCount}`;
   if(songCount > 0){
      avgEle.textContent = `Average Popularity : ${(popularitySum / songCount).toFixed(2)}`;
   } else {
      avgEle.textContent = `Average Popularity:N/A`;
   }
}

//---------------- Playlist Functions end ---------------------------------------------------------------

//--------------- Single Song View Functions ------------------------------------------------------------
/**
 * Switch page to single song window.
 * Requires a song to be displayed.
 * @param {*} song song object to be displayed.
 */
function singleSongPageSwitch(song){loadNewPage(Page.SingleSong, song);}
/**
 * Loads single song page and populartes initial values.
 * Populates song analytics, as well as calls to display a chart with info about that song.
 * @param {*} song 
 * @returns 
 */
function loadSingleSongPage(song){
   let artistInfo = document.querySelector('#singleSongArtistInformation');
   artistInfo.innerHTML = "";
   createAndAppendElement('p', artistInfo, song.artist.name, 'has-text-light is-size-4');
   createAndAppendElement('p', artistInfo, song.title);
   let dataList = document.querySelector('#singleSongDataList');
   dataList.innerHTML = "";
   createSongAnalyticsRow(dataList, 'BPM', song.details.bpm);
   createSongAnalyticsRow(dataList, 'Duration', secondsToFormatedMinutes(song.details.duration));
   createSongAnalyticsRow(dataList, 'Danceability', song.analytics.danceability);
   createSongAnalyticsRow(dataList, 'Liveness', song.analytics.liveness);
   createSongAnalyticsRow(dataList, 'Valence', song.analytics.valence);
   createSongAnalyticsRow(dataList, 'Acousticness', song.analytics.acousticness);
   createSongAnalyticsRow(dataList, 'Speechiness', song.analytics.speechiness);
   createSongAnalyticsRow(dataList, 'Popularity', song.details.popularity);

   createSongChart(song);
   //Promise stub, page loads need to return a promise
   return new Promise((resolve, reject) => {
      resolve();
      reject("You should really REALLY never see this message.")
   });
}
/**
 * Creates a row containing a label and its corresponding value, and
 * appends that to the parent list.
 * @param {*} list  Parent list to append to
 * @param {*} label String - label of the row
 * @param {*} value Any    - value to be displayed.
 */
function createSongAnalyticsRow(list, label, value){
   let row = createAndAppendElement('tr', list, null, 'songAnalyticsRow');
   createAndAppendElement('td', row, label, 'songAnalyticsLabel', `songAnalyticsLabel_${label}`);
   createAndAppendElement('td', row, value, 'songAnalyticsValue', `songAnalyticsValue_${value}`);
}
/**
 * Formats a number of seconds to the formate MM:SS.
 * Doesn't support hours.
 * @param {*} sec number of seconds total.
 * @returns formatted string.
 */
function secondsToFormatedMinutes(sec){
   let minutes = (Math.floor(sec / 60)).toString();
   while(minutes.length < 2){minutes = '0' + minutes;}
   sec = (sec % 60).toString();
   while(sec.length < 2){sec = '0' + sec;}
   return minutes + ":" + sec;
}
/**
 * Creates a song chart for a given song.
 * Charts are radar charts powered by chart.js
 * https://www.chartjs.org/
 * @param {*} song song object ot be displayed
 */
function createSongChart(song){
   let chartArea = document.querySelector('#singleSongRight');
   let canvas = document.querySelector('canvas#songRadarChart');
   //Delete current chart before making a new one
   if(canvas != null){canvas.remove();}
   canvas = createAndAppendElement('canvas', chartArea, null, 'has-background-grey-dark box', 'songRadarChart');
   let labels = [
      'danceability',
      'valence',
      'energy',
      'speechiness',
      'acousticness',
      'liveness',
   ];
   let values = [];
   for(let label of labels){values.push(song.analytics[label]);}
   
   let chartData = {labels: labels, datasets:[{
      label: song.title,
      data: values,
      fill: true,
      backgroundColor: 'rgba(2, 230, 196, 0.2)',
      borderColor: 'rgb(2, 230, 196)',
      tension: 0.5,
      pointBackgroundColor: 'rgb(0, 0, 0)',
      pointBorderColor: '#fff',
      pointHoverBackgroundColor: '#ffffff',
      pointHoverBorderColor: 'rgba(2, 230, 196, 0.5)'
   }]
   };
   let chartConfig = {
      type: 'radar',
      data: chartData,
      backgroundColor: '#000000',
      options: {
         plugins:{
            legend:{
               labels:{
                  font:{
                     size:26,
                  },
               }
            }
         },
         elements: {
            line: {
               borderWidth: 3
            }
         }
      },
   };
   
   Chart.defaults.backgroundColor = 'rgba(2, 230, 196, 0.2)'
   Chart.defaults.borderColor = '#EEEEEE'
   Chart.defaults.color = '#FFFFFF'
   Chart.defaults.font.size = 18;
   let chart = new Chart(canvas, chartConfig);
}


//--------------- Single Song View Functions End -------------------------------------------------------

//-----------------------------------Song and Misc Functions ----------------------------------------------------

/**
 * Sorts a song list in place based on the sort mode it is given
 * If mode is invalid, no sorting happens
 * LocaleCompare function found at this URL
 * https://www.freecodecamp.org/news/javascript-string-comparison-how-to-compare-strings-in-js/
 * @param {*} list 
 * @param {*} mode 
 */
function sortList(list, mode){
   if(mode == SortMode.Title){
      list.sort((x,y) => x.title.localeCompare(y.title));
   } else if (mode == SortMode.Artist){
      list.sort((x,y) => x.artist.name.localeCompare(y.artist.name));
   } else if (mode == SortMode.Genre){
      list.sort((x,y) => x.genre.name.localeCompare(y.genre.name));
   } else if (mode == SortMode.Year){
      list.sort((x,y) => x.year > y.year);
   }
}
/**
 * Retrieves an array of song objects
 * If the array is in local storage, it is retrieve, and parsed
 * If it is not in local storage, it is retrieved from the API, and stored locally
 * 
 * @returns a Promise which resolves to the javascript array of song objects
 */
function getSongs(){
   let songs = window.localStorage.getItem("Asg2Songs");
   if(songs != null){
      return new Promise((resolve, reject) => {
         resolve(JSON.parse(songs));
         reject("Failed to load from local storage");
      });
   } else {
      return fetch(api)
         .then(r => r.json())
         .then(songs => {
            window.localStorage.setItem("Asg2Songs", JSON.stringify(songs));
            return songs;
         })
         .catch((e) => console.log("Could not retrieve from API"));
   }
}
/**
 * Displays a snackbar style message.
 * Removes the message after a fixed amount of time.
 * The id of the message is tracked to ensure a message is not closed before it is done being shown.
 * @param {*} mes string - message to display
 * @param {*} id  any - arbitrary value assigned to the message. Make this unique if you don't want your message closing early.
 * @param {*} length optional - Length of time to show the message in ms, default 2000.
 */
function showMessage(mes, id, length=2000){
   let messageArea = document.querySelector('#messageArea');
   let messageContainer = document.querySelector('#messageContainer')
   messageArea.textContent = mes;
   messageArea.title = id;
   messageContainer.style.height = '50px';
   messageContainer.style.opacity = '1';
   setTimeout(()=> {
      if(messageArea.title == id){
         messageArea.title = "";
         messageArea.textContent = "";
         messageContainer.style.height = '0vh';
         messageContainer.style.opacity = '0';
      }
   }, length);
}

//----Tool Tips-------------------------------------------------------
//The idea for storing a key to ensure an object isn't destroyed early isn't mine
//However I have no idea where to attribute it, I learned it years ago while doing some C# stuff
function creditMouseEnter(){
   let tooltip = document.querySelector('#creditToolTip');
   tooltip.style.visibility = 'visible';
   tooltip.style.opacity    = 1;
   //Random key to make sure the destruction instance is the same as
   //the initialization instance
   let key = Math.floor((Math.random() * 1000000));
   tooltip.dataset.key = key;
   setTimeout(() => {
      if(tooltip.dataset.key != key){return;}
      tooltip.style.visibility = 'hidden';
      tooltip.style.opacity    = 0;
   }, 5000);
}