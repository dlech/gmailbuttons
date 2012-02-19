var gmailbuttons = {
  onLoad: function() {
    // initialization code
    this.initialized = true;
    this.strings = document.getElementById("gmailbuttons-strings");	
  },
  
  updateJunkSpamButtons: function() {
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
	// get message-specific header buttons	
	var deleteButton = document.getElementById("hdrTrashButton");
	var trashButton = document.getElementById("gmailbuttons-trash-button");
	var junkButton = document.getElementById("hdrJunkButton");
	var spamButton = document.getElementById("gmailbuttons-spam-button");
	
	var gmailHostNames = ["imap.gmail.com", "imap.googlemail.com"]; // TODO - pull these to a config file
	if (gmailHostNames.indexOf(svr.hostName) >= 0) { // this is a gmail account
	  deleteButton.oldTooltipText = deleteButton.tooltipText;
	  deleteButton.tooltipText = this.strings.getString("deleteButton.tooltip");
	  trashButton.hidden = false;
	  junkButton.hidden = true;
	  spamButton.hidden = false;
	} else { // this is not a gmail account
	  if (deleteButton.oldTooltipText)
	    deleteButton.tooltipText = deleteButton.oldTooltipText;
	  trashButton.hidden = true;
	  junkButton.hidden = false;
	  spamButton.hidden = true;
	}
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
  }
};

// listen for initial window load event
window.addEventListener("load", function () { gmailbuttons.onLoad(); }, false);
// listen for messages loading
gMessageListeners.push(gmailbuttons.messageHandler);