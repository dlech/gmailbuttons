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
  
  GetMessageFolder: function() {
    // get current message
    var hdr = gFolderDisplay.selectedMessage;
    // give up if no message selected or this is a dummy header
    if (!hdr || gMessageDisplay.isDummy) 
      return;
    // get folder that contains message
    var fldr = hdr.folder;
    if (!fldr) // message not in folder somehow?
      return;	
    return fldr;
  },  
  
  GetMessageServer: function() {
    var fldr = this.GetMessageFolder();
    if (!fldr) // message not in folder somehow?
      return;
    // get server that hosts folder
    var svr = fldr.server;
    if (!svr) // folder does not have server?
      return;
    return svr;
  },
  
  // returns true if message is in Gmail imap
  IsServerGmailIMAP: function(svr) {
    // check that svr parameter is valid
    if (!(svr instanceof Ci.nsIImapIncomingServer))
      return;
    // check to see if it is imap and Gmail server
    return (svr.type == "imap" && svr.isGMailServer);
  },
  
  IsSpecialFolder: function(fldr, flag) {
    // make sure this is a valid folder
    if (!(fldr instanceof Ci.nsMessageFolder))
	  return;
    // check if folder has special folder flag
    return fldr.isSpecialFolder(flag);
  },
  
  updateJunkSpamButtons: function() {
    
    /* get message-specific header buttons */
    var deleteButton = document.getElementById("hdrTrashButton");
    var trashButton = document.getElementById("gmailbuttons-trash-button");
    var junkButton = document.getElementById("hdrJunkButton");
    var spamButton = document.getElementById("gmailbuttons-spam-button");
        
    if (this.IsServerGmailIMAP(this.GetMessageServer())) { 
      // this is a Gmail imap account
    
      /* get actual folder names from server  */
      try {
        var svr = this.GetMessageServer();
        var svrRootFolder = svr.rootFolder;
        var trashFolder = this.getSpecialFolder(svrRootFolder, nsMsgFolderFlags.Trash);
        var spamFolder = this.getSpecialFolder(svrRootFolder, nsMsgFolderFlags.Junk);
      } catch(ex) {
        // don't need to do anything here
        //alert(ex);
      }
      // get label text
      var trashLabel = trashFolder ? trashFolder.prettiestName : 
          this.strings.getString("gmailbuttons.error");
      var spamLabel = spamFolder ? spamFolder.prettiestName : 
          this.strings.getString("gmailbuttons.error");
      // get tooltip text
      var trashTooltip = trashFolder ? 
          this.strings.getFormattedString("gmailbuttons.moveButton.tooltip",
          [trashFolder.URI.replace(svrRootFolder.URI, "").substr(1)], 1) : 
          this.strings.getString("gmailbuttons.error");
      var spamTooltip = spamFolder ? 
          this.strings.getFormattedString("gmailbuttons.moveButton.tooltip",
          [spamFolder.URI.replace(svrRootFolder.URI, "").substr(1)], 1) : 
          this.strings.getString("gmailbuttons.error");  
    
      if (deleteButton) {
        // save the original tooltip - this only runs once
        if (!deleteButton.oldTooltipText)
          deleteButton.oldTooltipText = deleteButton.tooltipText;
        // apply new tooltip
        deleteButton.tooltipText = this.strings.getString("gmailbuttons.deleteButton.tooltip");
      try {
        var showDelete = this.prefs.getBoolPref("showDeleteButton")		
        deleteButton.hidden = !showDelete;
        } catch(ex) {
        // preference does not exist - do nothing
      }
        }
      if (trashButton) {
        trashButton.hidden = false;
        trashButton.label = trashLabel;
        trashButton.tooltipText = trashTooltip;
      }
      if (junkButton)
        junkButton.hidden = true;
      if (spamButton)	{
        spamButton.hidden = false;
        spamButton.label = spamLabel;      
        spamButton.tooltipText = spamTooltip;
      }    
    } else { 
      // this is not a GMail account
      
      if (deleteButton) {
        if (deleteButton.oldTooltipText)
          deleteButton.tooltipText = deleteButton.oldTooltipText;
      deleteButton.hidden = false;
        }
      if (trashButton)	
          // if (!IsSpecialFolder(this.getMessageFolder(), Ci.nsMsgFolderFlags.Trash))	  
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
  messageListener: {
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
  
  folderDisplayListener: {
     onMessagesLoaded: function(aAll) {
       try {
        var hideJunkStatusCol = gmailbuttons.prefs.getBoolPref("hideJunkStatusCol")		
        // don't need to do anything if pref doesn't exist or is false
        if(!hideJunkStatusCol)
         return;
        // get the server from the selected folder
        var svr = aAll.displayedFolder.server;
        if (!svr)
          return;
        if (gmailbuttons.IsServerGmailIMAP(svr)) {      
          // hide junk status column
          var junkStatusColumn = document.getElementById("junkStatusCol");
          if (junkStatusColumn) {
            junkStatusColumn.hidden = true;
          }
        }
      } catch(ex) {
        // preference does not exist - do nothing
        //alert(ex);
      }
    },  
  },
  
  onBeforeCustomization: function(e) { 
    if (e.target.id == "header-view-toolbox")
      gmailbuttons.showAllButtons();
  },
  
  onAfterCustomization: function(e) {   
    if (e.target.id == "header-view-toolbox")  
      gmailbuttons.updateJunkSpamButtons();
  },

  // search for folder flagged as a special folder. i.e. Trash and Spam folders
  getSpecialFolder: function(fldr, flag) {
    /* TODO would be nice if we could do this directly using XPATH */
    
    
    
    /* for now, we use recurstion to search folders instead */
	
    // make sure we have a folder
    if (!(fldr instanceof Ci.nsIMsgFolder))
      return;
    // if folder is flagged as trash folder, retun the folder
    if (fldr.isSpecialFolder(flag))
      return fldr;
    // otherwise, search recursivly
    if (fldr.hasSubFolders) {
      var subfldrs = fldr.subFolders;
      while (subfldrs.hasMoreElements()) {
        var subfldr = subfldrs.getNext();
        var result = this.getSpecialFolder(subfldr, flag);
          if (result)
            return result;
      }
    }
    // no trash folders were found
    return;
  },
  
  // moves the selected message to a special folder. i.e. [Gmail]/Trash
  MoveToSpecialFolder: function(flag, e) {
    var svr = this.GetMessageServer();
    if (this.IsServerGmailIMAP(svr)) { // mesage is on Gmail imap server	  
      var specialFolder = this.getSpecialFolder(svr.rootFolder, flag);	  
        if (specialFolder) {
      gFolderDisplay.hintAboutToDeleteMessages();
          gDBView.doCommandWithFolder(nsMsgViewCommandType.moveMessages, specialFolder);
      //return; // otherwise show error mesage below
      }  
    } // trash button should not be visible if not a Gmail imap message
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
gMessageListeners.push(gmailbuttons.messageListener);
// listen for folder selection
FolderDisplayListenerManager.registerListener(gmailbuttons.folderDisplayListener);