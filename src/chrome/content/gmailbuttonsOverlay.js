
var gmailbuttons = {

  onLoad: function () {
    // initialization code
    this.initialized = true;
    this.strings = document.getElementById("gmailbuttons-strings");

    // add support for preferences
    this.extPrefs = Components.classes["@mozilla.org/preferences-service;1"]
        .getService(Components.interfaces.nsIPrefService)
        .getBranch("extensions.gmailbuttons.");
    this.extPrefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
    this.extPrefs.addObserver("", this, false);
  },

  onUnload: function () {
    // cleanup preferences
    this.extPrefs.removeObserver("", this);
  },

  observe: function (aSubject, aTopic, aData) {
    if (aTopic != "nsPref:changed") {
      return; // only need to act on pref change
    }
    // process change
    switch (aData) {
    case "showDeleteButton":
      this.updateJunkSpamButtons();
      break;
    }
  },

  GetMessageFolder: function () {
    var
      header,
      folder;

    // get current message
    header = gFolderDisplay.selectedMessage;
    // give up if no message selected or this is a dummy header
    if (!header || gMessageDisplay.isDummy) {
      return;
    }
    // get folder that contains message
    folder = header.folder;
    if (!folder) { // message not in folder somehow?
      return;
    }
    return folder;
  },

  GetMessageServer: function () {
    var
      folder,
      server;

    folder = this.GetMessageFolder();
    if (!folder) { // message not in folder somehow?
      return;
    }
    // get server that hosts folder
    server = folder.server;
    if (!server) { // folder does not have server?
      return;
    }
    return server;
  },

  // returns true if message is in Gmail imap
  IsServerGmailIMAP: function (aServer) {
    // check that server parameter is valid
    if (!(aServer instanceof Ci.nsIImapIncomingServer)) {
      return;
    }
    // check to see if it is imap and Gmail server
    // TODO - pull these to a config file
    var gmailHostNames = ["imap.gmail.com", "imap.googlemail.com"];
    // built-in isGMailServer function is broken in German version
    // of Thunderbird so we check the host name as well
    return (aServer.type == "imap" && aServer.isGMailServer) ||
      (gmailHostNames.indexOf(aServer.hostName) >= 0);
  },

  updateJunkSpamButtons: function () {

    var
      deleteButton,
      trashButton,
      junkButton,
      spamButton,
      server,
      serverPrefs,
      thisFolder,
      serverRootFolder,
      trashFolder,
      spamFolder,
      trashLabel,
      spamLabel,
      isTrashFolder,
      isSpamFolder,
      trashTooltip,
      spamTooltip,
      showDelete;

    /* get message-specific header buttons */
    deleteButton = document.getElementById("hdrTrashButton");
    trashButton = document.getElementById("gmailbuttons-trash-button");
    junkButton = document.getElementById("hdrJunkButton");
    spamButton = document.getElementById("gmailbuttons-spam-button");

    server = this.GetMessageServer();

    if (this.IsServerGmailIMAP(server)) {
      // this is a Gmail imap account

        // also look at mail.server prefs
      serverPrefs = Components.classes["@mozilla.org/preferences-service;1"]
          .getService(Components.interfaces.nsIPrefService)
          .getBranch("mail.server." + server.key + ".");

      thisFolder = this.GetMessageFolder();
      isTrashFolder = thisFolder.isSpecialFolder(Ci.nsMsgFolderFlags.Trash) ||
          (serverPrefs.prefHasUserValue("trash_folder_name") &&
          serverPrefs.getCharPref("trash_folder_name") == thisFolder.onlineName);
      isSpamFolder = thisFolder.isSpecialFolder(Ci.nsMsgFolderFlags.Junk);

      /* get actual folder names from server  */
      try {
        serverRootFolder = server.rootFolder;
        trashFolder = this.getSpecialFolder(serverRootFolder,
            nsMsgFolderFlags.Trash);
        spamFolder = this.getSpecialFolder(serverRootFolder,
          nsMsgFolderFlags.Junk);
      } catch (ex) {
        // don't need to do anything here
        //alert(ex);
      }
      /* get label text */
      trashLabel = trashFolder ? trashFolder.prettiestName :
          this.strings.getString("gmailbuttons.error");
      spamLabel = spamFolder ? spamFolder.prettiestName :
          this.strings.getString("gmailbuttons.error");

      /* get tooltip text */
      trashTooltip = trashFolder ?
          this.strings.getFormattedString("gmailbuttons.moveButton.tooltip",
            [trashFolder.URI.replace(serverRootFolder.URI, "").substr(1)], 1) :
          this.strings.getString("gmailbuttons.error");
      spamTooltip = spamFolder ?
          this.strings.getFormattedString("gmailbuttons.moveButton.tooltip",
            [spamFolder.URI.replace(serverRootFolder.URI, "").substr(1)], 1) :
          this.strings.getString("gmailbuttons.error");

      if (deleteButton) {
        // save the original tooltip - this only runs once
        if (!deleteButton.oldTooltipText) {
          deleteButton.oldTooltipText = deleteButton.tooltipText;
        }
        // apply new tooltip
        if (isTrashFolder || isSpamFolder) {
          deleteButton.tooltipText = this.strings.getString(
            "gmailbuttons.deleteButton.trashSpam.tooltip"
          );
        } else {
          deleteButton.tooltipText = this.strings.getString(
            "gmailbuttons.deleteButton.regular.tooltip"
          );
        }

        try {
          showDelete = this.extPrefs.getBoolPref("showDeleteButton");
          deleteButton.hidden = (!showDelete) &&
            !(isTrashFolder || isSpamFolder);
        } catch (ex) {
          // preference does not exist - do nothing
        }
      }
      if (trashButton) {
        trashButton.hidden = isTrashFolder;
        trashButton.label = trashLabel;
        trashButton.tooltipText = trashTooltip;
      }
      if (junkButton) {
        junkButton.hidden = true;
      }
      if (spamButton) {
        spamButton.hidden = isSpamFolder;
        spamButton.label = spamLabel;
        spamButton.tooltipText = spamTooltip;
      }
    } else {
      /* this is not a GMail account */

      if (deleteButton) {
        if (deleteButton.oldTooltipText) {
          deleteButton.tooltipText = deleteButton.oldTooltipText;
        }
        deleteButton.hidden = false;
      }
      if (trashButton) {
        trashButton.hidden = true;
      }
      if (junkButton) {
        junkButton.hidden = false;
      }
      if (spamButton) {
        spamButton.hidden = true;
      }
    }
  },

  // unhides all buttons - used during customization of toolbar
  showAllButtons: function () {

    var
      deleteButton,
      trashButton,
      junkButton,
      spamButton;

    // get message-specific header buttons
    deleteButton = document.getElementById("hdrTrashButton");
    trashButton = document.getElementById("gmailbuttons-trash-button");
    junkButton = document.getElementById("hdrJunkButton");
    spamButton = document.getElementById("gmailbuttons-spam-button");

    // show all buttons
    if (deleteButton) {
      deleteButton.hidden = false;
    }
    if (trashButton) {
      trashButton.hidden = false;
    }
    if (junkButton) {
      junkButton.hidden = false;
    }
    if (spamButton) {
      spamButton.hidden = false;
    }
  },

  // handle message header load events
  messageListener: {
    onStartHeaders: function () {
      // do nothing
    },

    onEndHeaders: function () {
      gmailbuttons.updateJunkSpamButtons();
      gmailbuttons.FetchLabels();
    },

    onEndAttachments: function () {
      // do nothing
    }
  },

  folderDisplayListener: {
    onMessagesLoaded: function (aAll) {

      var
        hideJunkStatusCol,
        server,
        junkStatusColumn;

      try {
        hideJunkStatusCol = gmailbuttons.extPrefs.getBoolPref("hideJunkStatusCol");
        // don't need to do anything if pref doesn't exist or is false
        if (!hideJunkStatusCol) {
          return;
        }
        // get the server from the selected folder
        server = aAll.displayedFolder.server;
        if (!server) {
          return;
        }
        if (gmailbuttons.IsServerGmailIMAP(server)) {
          // hide junk status column
          junkStatusColumn = document.getElementById("junkStatusCol");
          if (junkStatusColumn) {
            junkStatusColumn.hidden = true;
          }
        }
      } catch (ex) {
        // preference does not exist - do nothing
        //alert(ex);
      }
    }
  },

  onBeforeCustomization: function (aEvent) {
    if (aEvent.target.id == "header-view-toolbox") {
      gmailbuttons.showAllButtons();
    }
  },

  onAfterCustomization: function (aEvent) {
    if (aEvent.target.id == "header-view-toolbox") {
      gmailbuttons.updateJunkSpamButtons();
    }
  },

  // search for folder flagged as a special folder. i.e. Trash and Spam folders
  getSpecialFolder: function (aFolder, aFlag) {

    var
      subfolders,
      subfolder,
      result,
      server,
      serverPrefs,
      nsMsgFolderFlags;

    /* TODO would be nice if we could do this directly using XPATH */


    /* for now, we use recurstion to search folders instead */

    // make sure we have a valid folder
    if (!(aFolder instanceof Ci.nsIMsgFolder)) {
      return;
    }
    // if aFolder is flagged with aFlag, return it
    if (aFolder.isSpecialFolder(aFlag)) {
      return aFolder;
    }
    // otherwise, search recursivly
    if (aFolder.hasSubFolders) {
      subfolders = aFolder.subFolders;
      while (subfolders.hasMoreElements()) {
        subfolder = subfolders.getNext();
        result = this.getSpecialFolder(subfolder, aFlag);
        if (result) {
          return result;
        }
      }
    }
    // if nothing with matching flags were found, try looking in user prefs
    server = aFolder.server;
    serverPrefs = Components.classes["@mozilla.org/preferences-service;1"]
        .getService(Components.interfaces.nsIPrefService)
        .getBranch("mail.server." + server.key + ".");
    nsMsgFolderFlags = Components.interfaces.nsMsgFolderFlags;
    if (aFlag == nsMsgFolderFlags.Trash && serverPrefs.prefHasUserValue("trash_folder_name")) {
      return aFolder.rootFolder.findSubFolder(serverPrefs.getCharPref("trash_folder_name"));
    }
    // no matching folders were found
    return;
  },

  // moves the selected message to a special folder. i.e. [Gmail]/Trash
  MoveToSpecialFolder: function (aFlag, aEvent) {

    var
      server,
      specialFolder;

    server = this.GetMessageServer();
    if (this.IsServerGmailIMAP(server)) { // mesage is on Gmail imap server
      specialFolder = this.getSpecialFolder(server.rootFolder, aFlag);
      if (specialFolder) {
        gFolderDisplay.hintAboutToDeleteMessages();
        gDBView.doCommandWithFolder(nsMsgViewCommandType.moveMessages,
          specialFolder);
        //return; // otherwise show error mesage below
      }
    } // trash button should not be visible if not a Gmail imap message
  // TODO may want error message here
  },

  CreateMessageLabelButton : function (aId, aLabel) {

    var
      XUL_NS,
      item,
      labelLabel,
      deleteMsgFromFolder,
      delButton;

    XUL_NS =
      "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
    // create a new XUL toolbarbutton
    item = document.createElementNS(XUL_NS, "label");
    item.setAttribute("id", aId);
    item.setAttribute("fetched-label", aLabel);
    item.setAttribute("style", "-moz-appearance: tooltip;" +
      "padding: 0px !important; margin: 0px 2px !important;");
    // strip enclosing quotes if present
    if ((aLabel.indexOf("\"") == 0) &&
        (aLabel.lastIndexOf("\"") == (aLabel.length - 1))) {
      aLabel = aLabel.substring(1, aLabel.length - 1);
    }
    // strip leading backslashes if present (on special folders)
    if (aLabel.indexOf("\\\\") == 0) {
      aLabel = aLabel.substring(2);
    }
    labelLabel = document.createElementNS(XUL_NS, "label");
    labelLabel.setAttribute("value", aLabel);
    item.appendChild(labelLabel);

    deleteMsgFromFolder = function () {

      var
        folderName,
        server,
        folder,
        messageDeletedUrlListener,
        searchMsgIdUrlListener,
        fetchXGmMsgidUrlListener;

      folderName = item.getAttribute("fetched-label");
      // remove enclosing quotes
      if ((folderName.indexOf("\"") == 0) &&
          (folderName.lastIndexOf("\"") == (folderName.length - 1))) {
        folderName = folderName.substring(1, folderName.length - 1);
      }
      // leading '\\' indicates that this is a 'special' folder
      if (folderName.indexOf('\\\\') == 0) {
        // TODO make "[Gmail]" a preference or find a way to fetch it
        // from server
        folderName = folderName.substring(2);
        // TODO need to do something different here
        // to test for Inbox and Important - from XLIST perhaps
        if (folderName != "Inbox" && folderName != "Important") {
          folderName = '[Gmail]/' + folderName;
        }
      }

      server = gmailbuttons.GetMessageServer();
      // TODO escape folderName if needed
      folder = server.rootFolder.findSubFolder(folderName);

      messageDeletedUrlListener = {
        /* since message is deleted and not moved to trash,
         * the nsIMsgCopyServiceListener interface is not used
         */
        OnStartCopy: function () { },
        OnProgress: function (aProgress, aProgressMax) { },
        SetMessageKey : function (aKey) { },
        GetMessageId : function (aMessageId) { },
        OnStopCopy : function (aStatus) { },

        OnStartRunningUrl: function (aUrl) {
          // don't do anything on start
        },

        OnStopRunningUrl: function (aUrl, aExitCode) {
          // update labels after message has been deleted
          gmailbuttons.FetchLabels();
        },

        QueryInterface: function (iid) {
          if (!iid.equals(Ci.nsIUrlListener) &&
              !iid.equals(Ci.nsIMsgCopyServiceListener) &&
              !iid.equals(Ci.nsISupports)) {
            throw Components.results.NS_ERROR_NO_INTERFACE;
          }
          return this;
        }
      };

      /* this listener actually deletes the message */
      searchMsgIdUrlListener = {
        onSearchHit: function (aHeader, aFolder) {
          var
            messages;

          //var msgId = aHeader.messageKey;
          messages = Components.classes["@mozilla.org/array;1"]
              .createInstance(Components.interfaces.nsIMutableArray);
          messages.appendElement(aHeader, false);
          folder.deleteMessages(messages, msgWindow, true, false,
            messageDeletedUrlListener, false);
        },

        onSearchDone : function (aStatus) {
          // do nothing
        },

        onNewSearch : function () {
          // do nothing
        }
      };

      /* this is the callback for the FETCH X-GM-MSGID command */
      fetchXGmMsgidUrlListener = {
        OnStartRunningUrl: function (aUrl) {
          // don't do anything on start
        },

        OnStopRunningUrl: function (aUrl, aExitCode) {

          var
            msgId,
            uri,
            searchTerm;

          aUrl.QueryInterface(Ci.nsIImapUrl);
          msgId = aUrl.customAttributeResult; // the Gmail message id
          folder.QueryInterface(Ci.nsIMsgImapMailFolder);

          /* now search for the matching message in the folder
           * that was obtained from the label
           */
          uri = folder.issueCommandOnMsgs("SEARCH X-GM-MSGID",
            msgId, msgWindow);
          uri.QueryInterface(Ci.nsIMsgMailNewsUrl);

          /* have to create a fake searchSession to get the results
           * of the search command that was sent using issueCustomCommandOnMsgs
           */
          uri.searchSession = Cc["@mozilla.org/messenger/searchSession;1"]
            .createInstance(Ci.nsIMsgSearchSession);
          // use onlineMail scope so that search will stay running until
          // after onSearchHit callback is called from the result
          // of the issueCommandOnMsgs
          uri.searchSession.addScopeTerm(Ci.nsMsgSearchScope.onlineMail,
            folder);

          /* search terms are not acutally used -
           * dummy values are so searchSession initializes properly */
          searchTerm = uri.searchSession.createTerm(); // dummy search terms
          searchTerm.attrib = Ci.nsMsgSearchAttrib.Size; // dummy attrib
          // This is tricky - value.attrib must be set before actual values
          // see http://mxr.mozilla.org/comm-central/source/mailnews/base/test/unit/test_bug404489.js#183
          searchTerm.value.attrib = searchTerm.attrib;
          searchTerm.value.size = 0; // message should never have size < 0
          searchTerm.op = Ci.nsMsgSearchOp.IsLessThan;
          uri.searchSession.appendTerm(searchTerm);

          uri.searchSession.registerListener(searchMsgIdUrlListener);
          uri.searchSession.search(null); // null so progress bar does not show
        }
      };

      gmailbuttons.FetchCustomAttribute(gFolderDisplay.selectedMessage,
        "X-GM-MSGID", fetchXGmMsgidUrlListener);
    };

    delButton = document.createElementNS(XUL_NS, "label");
    delButton.setAttribute("style", "-moz-appearance: button;" +
      " padding: 0px 2px !important; margin: 0px !important;");
    delButton.setAttribute("value", "X");
    delButton.addEventListener("click", deleteMsgFromFolder, false);
    //delButton.setAttribute("command", "gmailbuttons-remove-label");
    item.appendChild(delButton);

    return item;
  },

  FetchCustomAttribute: function (aMessage, aAttribute, aUrlListener) {
    var
      folder,
      uri;

    folder = aMessage.folder;
    folder.QueryInterface(Ci.nsIMsgImapMailFolder);

    uri = folder.fetchCustomMsgAttribute(aAttribute,
      aMessage.messageKey, msgWindow);
    uri.QueryInterface(Ci.nsIMsgMailNewsUrl);
    uri.RegisterListener(aUrlListener);
  },

  FetchLabels : function () {
    var
      urlListener,
      message,
      i,
      toolbar,
      button,
      hbox;

    try {
      // fetchCustomAttribute result is returned asyncronously so we have
      // to create a listener to handle the result.
      urlListener = {
        OnStartRunningUrl: function (aUrl) {
          // don't do anything on start
        },

        OnStopRunningUrl: function (aUrl, aExitCode) {
          var
            labels,
            reg,
            toolbar,
            i,
            button,
            noneDesc;

          aUrl.QueryInterface(Ci.nsIImapUrl);
          // only add labels to ui if message has not changed
          // since call was made
          if (gFolderDisplay.selectedMessage.messageKey ==
              aUrl.listOfMessageIds) {
            labels = aUrl.customAttributeResult;
            // trim parenthensis
            if ((labels.indexOf("(") == 0) &&
                (labels.lastIndexOf(")") == (labels.length - 1))) {
              labels = labels.substring(1, labels.length - 1);
            }
            // split on spaces that are not within quotes
            // thank you http://stackoverflow.com/a/6464500
            reg = /[ ](?=(?:[^"\\]*(?:\\.|"(?:[^"\\]*\\.)*[^"\\]*"))*[^"]*$)/g;
            labels = labels.split(reg);
            toolbar = document.getElementById("gmailbuttons-label-toolbar");
            for (i = 0; i < labels.length; i++) {
              if (labels[i].length == 0) {
                break;
              }
              button = gmailbuttons.
                CreateMessageLabelButton("gmailbuttons-label" + i, labels[i]);
              toolbar.appendChild(button);
            }
            // show "None" if there are no labels
            noneDesc = document.getElementById("gmailbuttons-labels-none");
            noneDesc.hidden = (i > 0);
          }
        }
      };

      /* remove existing label buttons */
      i = 0;
      toolbar = document.getElementById("gmailbuttons-label-toolbar");
      while (button = document.getElementById("gmailbuttons-label" + i)) {
        toolbar.removeChild(button);
        i++;
      }

      hbox = document.getElementById("gmailbuttons-header-view");
      // only show gmail labels if we are in a gmail account
      if (this.IsServerGmailIMAP(this.GetMessageServer())) {
        hbox.hidden = false;
        message = gFolderDisplay.selectedMessage;
        this.FetchCustomAttribute(message, "X-GM-LABELS", urlListener);
      } else {
        hbox.hidden = true;
      }
    } catch (ex) {
      alert(ex);
    }
  }
};

// listen for initial window load event
window.addEventListener("load", function () { gmailbuttons.onLoad(); }, false);
// listen for window unload event
window.addEventListener("unload", function () { gmailbuttons.onUnload(); },
  false);
// listen for customization events
window.addEventListener("beforecustomization",
  function (e) { gmailbuttons.onBeforeCustomization(e); }, false);
window.addEventListener("aftercustomization",
  function (e) { gmailbuttons.onAfterCustomization(e); }, false);
// listen for messages loading
gMessageListeners.push(gmailbuttons.messageListener);
// listen for folder selection
FolderDisplayListenerManager.
  registerListener(gmailbuttons.folderDisplayListener);