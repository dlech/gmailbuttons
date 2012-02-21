var gmailbuttons = {
  onLoad: function() {
    // initialization code
    this.initialized = true;
    this.strings = document.getElementById("gmailbuttons-strings");	
	// add support for preferences
	this.prefs = Components.classes["@mozilla.org/preferences-service;1"]  
         .getService(Components.interfaces.nsIPrefService)  
         .getBranch("extensions.gmailbuttons.");  
     this.prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);  
	 this.prefs.addObserver("", this, false); 
  },
  
  onUnload: function() {
    // cleanup preferences
    this.prefs.removeObserver("", this);  
  },
  
  observe: function(subject, topic, data) {  
    if (topic != "nsPref:changed") {  
      return; // only need to act on pref change
    }  
    // process change	
    switch(data) {  
      case "showDeleteButton":  
         this.updateJunkSpamButtons();
         break;  
      }  
  },  
  
  GetMessageServer: function() {
    // get current message
	var hdr = gFolderDisplay.selectedMessage;
    // give up if no message selected or this is a dummy header
    if (!hdr || gMessageDisplay.isDummy) 
      return;
	// get folder that contains message
	var fldr = hdr.folder;
	if (!fldr) // message not in folder somehow?
		return;
	// get server that hosts folder
	var svr = fldr.server;
	if (!svr) // folder does not have server?
		return;
	return svr;
  },
  
  // returns true if message is in gmail imap
  IsMessageGmailIMAP: function() {	
	var gmailHostNames = ["imap.gmail.com", "imap.googlemail.com"]; // TODO - pull these to a config file
	var svr = this.GetMessageServer();
	if (svr) 
	  return gmailHostNames.indexOf(svr.hostName) >= 0;
	return false;
  },
  
  updateJunkSpamButtons: function() {
	
	// get message-specific header buttons	
	var deleteButton = document.getElementById("hdrTrashButton");
	var trashButton = document.getElementById("gmailbuttons-trash-button");
	var junkButton = document.getElementById("hdrJunkButton");
	var spamButton = document.getElementById("gmailbuttons-spam-button");
	
	if (this.IsMessageGmailIMAP()) { // this is a gmail imap account
	  if (deleteButton) {
	    // save the original tooltip - this only runs once
	    if (!deleteButton.oldTooltipText)
	      deleteButton.oldTooltipText = deleteButton.tooltipText;
	    deleteButton.tooltipText = this.strings.getString("deleteButton.tooltip");
		try {
		  showDelete = this.prefs.getBoolPref("showDeleteButton")		
		  deleteButton.hidden = !showDelete;
	    } catch(ex) {
		  // preference does not exist - do nothing
		}
      }
	  if (trashButton)
	    trashButton.hidden = false;
	  if (junkButton)
	    junkButton.hidden = true;
	  if (spamButton)	
	    spamButton.hidden = false;
	} else { // this is not a gmail account
	  if (deleteButton) {
	    if (deleteButton.oldTooltipText)
	      deleteButton.tooltipText = deleteButton.oldTooltipText;
		deleteButton.hidden = false;
      }
	  if (trashButton)
	    trashButton.hidden = true; // TODO hide trash button if we are in the [Gmail]/Trash folder
	  if (junkButton)
	    junkButton.hidden = false;
	  if (spamButton)
	    spamButton.hidden = true;
	}
  },
  
  // unhides all buttons - used during customization of toolbar
  showAllButtons: function() {
	
	// get message-specific header buttons	
	var deleteButton = document.getElementById("hdrTrashButton");
	var trashButton = document.getElementById("gmailbuttons-trash-button");
	var junkButton = document.getElementById("hdrJunkButton");
	var spamButton = document.getElementById("gmailbuttons-spam-button");
		
	// show all buttons
	if (deleteButton) 
      deleteButton.hidden = false;
	if (trashButton)
	  trashButton.hidden = false;
	if (junkButton)
	  junkButton.hidden = false;
	if (spamButton)	
	  spamButton.hidden = false;	
  },
    
  // handle message header load events
  messageHandler: {
	onStartHeaders: function() {
		// do nothing
	},
	
	onEndHeaders: function() {
		gmailbuttons.updateJunkSpamButtons();
	},
	
	onEndAttachments: function() {
		// do nothing
	}	
  },
  
  onBeforeCustomization: function(e) { 
	if (e.target.id == "header-view-toolbox")
	  gmailbuttons.showAllButtons();
  },
  
  onAfterCustomization: function(e) {   
	if (e.target.id == "header-view-toolbox")  
	  gmailbuttons.updateJunkSpamButtons();
  },

  // moves the selected message to the [Gmail]/Trash folder
  MoveToTrash: function(e) {
    if (this.IsMessageGmailIMAP()) { // mesage is on gmail imap server
	  var svr = this.GetMessageServer();
	  var gmailFolder = svr.rootFolder.getChildNamed("[Gmail]");
	  if (gmailFolder) {
	    gmailTrashFolder = gmailFolder.getChildNamed("Trash");
		if (gmailTrashFolder) {
		  gFolderDisplay.hintAboutToDeleteMessages();
          gDBView.doCommandWithFolder(nsMsgViewCommandType.moveMessages, gmailTrashFolder);
		  //return; // otherwise show error mesage below
		}
      }
	} // trash button should not be visivle if not a gmail imap message
	// TODO may want error message here
  },

  // moves the selected message to the [Gmail]/Spam folder
  MoveToSpam: function(e) {
    if (this.IsMessageGmailIMAP()) { // mesage is on gmail imap server
	  var svr = this.GetMessageServer();
	  var gmailFolder = svr.rootFolder.getChildNamed("[Gmail]");
	  if (gmailFolder) {
	    gmailTrashFolder = gmailFolder.getChildNamed("Spam");
		if (gmailTrashFolder) {
		  gFolderDisplay.hintAboutToDeleteMessages();
          gDBView.doCommandWithFolder(nsMsgViewCommandType.moveMessages, gmailTrashFolder);
		  //return; // otherwise show error mesage below
		}
      }
	} // trash button should not be visivle if not a gmail imap message
	// TODO may want error message here
  }    
};

// listen for initial window load event
window.addEventListener("load", function () { gmailbuttons.onLoad(); }, false);
// listen for window unload event
window.addEventListener("unload", function () { gmailbuttons.onUnload(); }, false);
// listen for customization events
window.addEventListener("beforecustomization", function (e) { gmailbuttons.onBeforeCustomization(e); }, false);
window.addEventListener("aftercustomization", function (e) { gmailbuttons.onAfterCustomization(e); }, false);
// listen for messages loading
gMessageListeners.push(gmailbuttons.messageHandler);