Components.utils.import("resource://gmailbuttons/socket.jsm");

const OAuth2Module = Components.Constructor("@mozilla.org/mail/oauth2-module;1",
                                            "msgIOAuth2Module", "initFromMail");

function gmailbuttonsSocket() {}
gmailbuttonsSocket.prototype = {
  __proto__ : Socket,
  log : function(aString) {
    if (aString == 'onStartRequest' || aString.indexOf('onStopRequest') == 0 ||
        aString.indexOf('onTransportStatus') == 0) {
      return;
    }
    //alert(aString);
  }
}

var gmailbuttons = {

  // These flags come from the GMail IMAP API and are based on RFC 6154
  _specialFolderRegex : /\\Inbox|\\All|\\Important|\\Drafts|\\Flagged|\\Junk|\\Sent|\\Trash/i,

  // used to store special folder mappings for each account
  SpecialFolderMap : {},

  onLoad: function () {
    // initialization code
    this.initialized = true;
    this.strings = document.getElementById("gmailbuttons-strings");

    // get Thunderbird app version
    this.appVersion = Services.appinfo.version;

    // add support for preferences
    this.extPrefs = Services.prefs.getBranch("extensions.gmailbuttons.");
    this.extPrefs.addObserver("", this, false);

    Services.obs.addObserver(this, "network:offline-status-changed", false);
        
    Services.obs.addObserver(gmailbuttons.CreateDbObserver, "MsgCreateDBView", false);
  },

  onUnload: function () {
    // cleanup preferences
    this.extPrefs.removeObserver("", this);
  },

  observe: function (aSubject, aTopic, aData) {
    switch (aTopic) {
      case "nsPref:changed":
        switch (aData) {
          case "showDeleteButton":
            this.updateJunkSpamButtons();
            break;
          case "showGmailInfo":
            this.UpdateMessageId();
            this.UpdateThreadId();
            this.UpdateOfflineFolder();
            break;
          case "showGmailLabels":
            this.UpdateLabels();
            break;
        }
        break;
      case "network:offline-status-changed":
        if (aData == "online") {
          for (var server in this.SpecialFolderMap) {
            if (Object.keys(this.SpecialFolderMap[server]).length < 7) {
              // if we got special folder info in offline mode, it will be
              // incomplete so now that we are back online, we clear the info so
              // that it is fetched again using LIST instead.
              this.SpecialFolderMap[server] = null;
            }
          }
        }
        this.UpdateLabels();
        break;
    }
  },
  
  CreateDbObserver : {
    // Components.interfaces.nsIObserver
    observe: function(aMsgFolder, aTopic, aData)
    {  
       gDBView.addColumnHandler("gmailbuttons-offline-storage-column",
          gmailbuttons.OfflineStorageLocationColumnHandler);
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
    folder.QueryInterface(Ci.nsIMsgFolder);
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
      serverRootFolder,
      trashFolder,
      spamFolder,
      isTrashFolder,
      isSpamFolder,
      showDelete;

    /* get message-specific header buttons */
    deleteButton = document.getElementById("hdrTrashButton");
    trashButton = document.getElementById("gmailbuttons-trash-button");
    junkButton = document.getElementById("hdrJunkButton");
    spamButton = document.getElementById("gmailbuttons-spam-button");

    server = gmailbuttons.GetMessageServer();

    if (gmailbuttons.IsServerGmailIMAP(server)) {
      // this is a Gmail imap account

      if (!gmailbuttons.SpecialFolderMap[server.key]) {
        gmailbuttons.getSpecialFolders(server, gmailbuttons.updateJunkSpamButtons);
        return;
      }

      // also look at mail.server prefs
      serverPrefs = Components.classes["@mozilla.org/preferences-service;1"]
          .getService(Components.interfaces.nsIPrefService)
          .getBranch("mail.server." + server.key + ".");
      /* get actual folder names from server  */
      try {
        serverRootFolder = server.rootFolder;
        trashFolder = gmailbuttons.SpecialFolderMap[server.key]["\\Trash"].imapFolder;
        spamFolder = gmailbuttons.SpecialFolderMap[server.key]["\\Junk"].imapFolder;
        var thisFolder = gmailbuttons.GetMessageFolder();
        isTrashFolder = trashFolder.URI == thisFolder.URI;
        isSpamFolder = spamFolder.URI == thisFolder.URI;
      } catch (ex) {
        // don't need to do anything here
        //alert(ex);
      }
      /* get label text */
      var trashLabel = trashFolder ? trashFolder.prettiestName :
          gmailbuttons.strings.getString("gmailbuttons.error");
      var spamLabel = spamFolder ? spamFolder.prettiestName :
          gmailbuttons.strings.getString("gmailbuttons.error");
      var notSpamLabel = spamFolder ?
          gmailbuttons.strings.getFormattedString("gmailbuttons.notButton",
            [ spamFolder.prettiestName ], 1) :
          gmailbuttons.strings.getString("gmailbuttons.error");

      /* get tooltip text */
      var trashTooltip = trashFolder ?
          gmailbuttons.strings.getFormattedString("gmailbuttons.moveButton.tooltip",
            [trashFolder.URI.replace(serverRootFolder.URI, "").substr(1)], 1) :
          gmailbuttons.strings.getString("gmailbuttons.error");
      var spamTooltip = spamFolder ?
          gmailbuttons.strings.getFormattedString("gmailbuttons.moveButton.tooltip",
            [spamFolder.URI.replace(serverRootFolder.URI, "").substr(1)], 1) :
          gmailbuttons.strings.getString("gmailbuttons.error");
      var notSpamTooltip = spamFolder ?
          gmailbuttons.strings.getFormattedString("gmailbuttons.moveButton.tooltip",
            [ "INBOX" ], 1) :
          gmailbuttons.strings.getString("gmailbuttons.error");

      if (deleteButton) {
        // save the original tooltip - this only runs once
        if (!deleteButton.oldTooltipText) {
          deleteButton.oldTooltipText = deleteButton.tooltipText;
        }
        // apply new tooltip
        if (isTrashFolder || isSpamFolder) {
          deleteButton.tooltipText = gmailbuttons.strings.getString(
            "gmailbuttons.deleteButton.trashSpam.tooltip"
          );
        } else {
          deleteButton.tooltipText = gmailbuttons.strings.getString(
            "gmailbuttons.deleteButton.regular.tooltip"
          );
        }

        try {
          showDelete = gmailbuttons.extPrefs.getBoolPref("showDeleteButton");
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
        spamButton.hidden = false;
        if (isSpamFolder) {
          spamButton.label = notSpamLabel;
          spamButton.tooltipText = notSpamTooltip;
          spamButton.setAttribute ("oncommand",
            "gmailbuttons.MoveToSpecialFolder('\\\\Inbox', event);");
        } else {
          spamButton.label = spamLabel;
          spamButton.tooltipText = spamTooltip;
          spamButton.setAttribute ("oncommand",
            "gmailbuttons.MoveToSpecialFolder('\\\\Junk', event);");
        }
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
        spamButton.oncommand = function () {};
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
      gmailbuttons.UpdateLabels();
      gmailbuttons.UpdateMessageId();
      gmailbuttons.UpdateThreadId();
      gmailbuttons.UpdateOfflineFolder();
    },

    onEndAttachments: function () {
      // do nothing
    }
  },

  onBeforeCustomization: function (aData) {
    if (aData.target.id == "header-view-toolbox") {
      gmailbuttons.showAllButtons();
    }
  },

  onAfterCustomization: function (aData) {
    if (aData.target.id == "header-view-toolbox") {
      gmailbuttons.updateJunkSpamButtons();
    }
  },

  /** Use LIST to create map of special folders for specified server.
   * executes (optional) aCallback when finished */
  getSpecialFolders: function (aServer, aCallback) {

    aServer.QueryInterface(Ci.nsIMsgIncomingServer);
    if (!gmailbuttons.SpecialFolderMap[aServer.key]) {
      var newServer = {};

      // if we are offline, we only fetch the minimum flags needed for trash
      // and spam buttons. This will be cleared when we go back online.
      if (Services.io.offline) {
        const xlistInbox = 0x4000;
        const xlistTrashFlag = 0x10000;
        const xlistSpamFlag = 0x1000;
        var recursiveSearch = function(aFolder, aFlag) {
          aFolder.QueryInterface(Ci.nsIMsgImapMailFolder);
          if (aFolder.boxFlags & aFlag) {
            return aFolder;
          }
          if (aFolder.hasSubFolders) {
            var subfolders = aFolder.subFolders;
            while (subfolders.hasMoreElements()) {
              var subfolder = subfolders.getNext();
              var result = recursiveSearch(subfolder, aFlag);
              if (result) {
                return result;
              }
            }
          }
        };
        var inboxFolder = {}
        inboxFolder.imapFolder = recursiveSearch(aServer.rootFolder, xlistInbox);
        inboxFolder.onlineName = inboxFolder.imapFolder.onlineName;
        newServer["\\Inbox"] = inboxFolder;
        var trashFolder = {};
        trashFolder.imapFolder = recursiveSearch(aServer.rootFolder, xlistTrashFlag);
        trashFolder.onlineName = trashFolder.imapFolder.onlineName;
        newServer["\\Trash"] = trashFolder;
        var spamFolder = {};
        spamFolder.imapFolder = recursiveSearch(aServer.rootFolder, xlistSpamFlag);
        spamFolder.onlineName = spamFolder.imapFolder.onlineName;
        newServer["\\Junk"] = spamFolder;

        gmailbuttons.SpecialFolderMap[aServer.key] = newServer;
        if (typeof aCallback === "function") {
          aCallback.call();
        }
        return;
      }

      // If we are online, we use LIST

      // INBOX always exists, so don't need to use LIST for it.
      // This saves us from having to call LIST twice
      var inboxFolder = {}
      inboxFolder.imapFolder = aServer.rootFolder.findSubFolder ("INBOX");
      inboxFolder.onlineName = inboxFolder.imapFolder.onlineName;
      newServer["\\Inbox"] = inboxFolder;


      // TODO extract socket stuff to function
      var socket = new gmailbuttonsSocket(this);

      var onDataReceived1;
      var onDataReceived2;
      var onDataReceived3;
      var onDataReceived3x;
      var onDataReceived4;

      onDataReceived1 = function (aData) {
        if (typeof aData === "string") {
          // response starts with '* OK'
          if (aData.search(/^\* OK/i) == 0) {
            socket.onDataReceived = onDataReceived2;
            return;
          }
        }
        alert("closing socket1\n\n" + aData);
        socket.disconnect();
      };

      onDataReceived2 = function (aData) {
        if (aData.search(/1 OK/i) >= 0) {
          socket.onDataReceived = onDataReceived3;
          // Add [GMail]/* special folders are at the second level. Using '%'
          // wildcard for the first level the first level as well since I think
          // some locations have [googlemail] possibly?
          socket.sendString('2 LIST "" %/%\r\n');
          return;
        }
        if (aData.search(/^\+ /i) == 0) {
          // oauth error - have to send \r\n to get error message
          socket.onDataReceived = onDataReceived3x;
          socket.sendString('\r\n');
          return;
        }
        alert("closing socket2\n\n" + aData);
        socket.disconnect();
      };

      onDataReceived3 = function (aData) {
        if (aData.search(/2 OK/i) >= 0) {
          socket.onDataReceived = onDataReceived4;
          var lines = aData.split("\r\n");
          for (var i = 0; i < lines.length; i++) {
            var newFolder = {};
            var flag = lines[i].match(gmailbuttons._specialFolderRegex);
            if (flag) {
              var match = lines[i].match(/LIST \([^\(]*\) "." "?([^"]*)"?/i);
              if (match.length > 1) {
                var folderName = match[1];
                newFolder.onlineName = folderName;
                newFolder.imapFolder = aServer.rootFolder.findSubFolder(folderName);
                newServer[flag] = newFolder;
              }
            }
          }
          if (Object.keys(newServer).length > 0) {
            gmailbuttons.SpecialFolderMap[aServer.key] = newServer;
          }
          socket.disconnect();
          if (typeof aCallback === "function") {
            aCallback.call();
          }
        }
      };

      onDataReceived3x = function (aData) {
        alert("closing socket3x\n\n" + aData);
        socket.disconnect();
      };

      onDataReceived4 = function (aData) {};

      socket.onDataReceived = onDataReceived1;
      socket.connect(aServer.realHostName, aServer.port, ["ssl"]);
      socket.onConnection = function () {
        switch (aServer.authMethod) {
        case Ci.nsMsgAuthMethod.passwordCleartext:
          socket.sendString('1 LOGIN "' + aServer.realUsername + '" "' +
              aServer.password.replace('\\', '\\\\').replace('"', '\\"') + '"\r\n');
          break;
        case Ci.nsMsgAuthMethod.OAuth2:
          let oauth = new OAuth2Module(aServer);
          // https://github.com/dlech/gmailbuttons/issues/34
          // This function is no longer available
          if (!oauth.buildXOAuth2String) {
            break;
          }
          oauth.connect(false, {
            onSuccess(token) {
              let sasl = oauth.buildXOAuth2String();
              socket.sendString('1 AUTHENTICATE XOAUTH2 ' + sasl + '\r\n');
            },
            onFailure(msg) {
              alert("Failed to connect via oauth: " + msg);
            }
          });
          break;
        }
      }
    }
  },

  // moves the selected message to a special folder. i.e. [Gmail]/Trash
  MoveToSpecialFolder: function (aFlag, aData) {

    var
      server,
      specialFolder;

    server = gmailbuttons.GetMessageServer();
    if (gmailbuttons.IsServerGmailIMAP(server)) { // message is on Gmail imap server
      specialFolder = gmailbuttons.SpecialFolderMap[server.key][aFlag].imapFolder;
      if (specialFolder) {
        gFolderDisplay.hintAboutToDeleteMessages();
        gDBView.doCommandWithFolder(nsMsgViewCommandType.moveMessages,
          specialFolder);
        //return; // otherwise show error message below
      }
    } // trash button should not be visible if not a Gmail imap message
  // TODO may want error message here
  },

  UpdateMessageId: function () {

    var messageIdLabel = document.getElementById("gmailbuttons-messageId-label");
    var messageIdValue = document.getElementById("gmailbuttons-messageId");

    if (gmailbuttons.IsServerGmailIMAP(gmailbuttons.GetMessageServer()) &&
        Services.vc.compare(gmailbuttons.appVersion, "17.0b1") >= 0 &&
        gmailbuttons.extPrefs.getBoolPref("showGmailInfo")) {
      messageIdLabel.hidden = false;
      messageIdValue.hidden = false;
      var msgId = gFolderDisplay.selectedMessage.getStringProperty("X-GM-MSGID");
      messageIdValue.headerValue = (msgId && msgId.length > 0) ? msgId : '???';
    } else {
      messageIdLabel.hidden = true;
      messageIdValue.hidden = true;
    }
  },

  UpdateThreadId: function () {

    var threadIdLabel = document.getElementById("gmailbuttons-threadId-label");
    var threadIdValue = document.getElementById("gmailbuttons-threadId");

    if (gmailbuttons.IsServerGmailIMAP(gmailbuttons.GetMessageServer()) &&
        Services.vc.compare(gmailbuttons.appVersion, "17.0b1") >= 0 &&
        gmailbuttons.extPrefs.getBoolPref("showGmailInfo")) {
      threadIdLabel.hidden = false;
      threadIdValue.hidden = false;
      var theadId = gFolderDisplay.selectedMessage.getStringProperty("X-GM-THRID");
      threadIdValue.headerValue = (theadId && theadId.length > 0) ? theadId : '???';
    } else {
      threadIdLabel.hidden = true;
      threadIdValue.hidden = true;
    }
  },

  UpdateOfflineFolder: function () {

    var offlineFolderLabel = document.getElementById("gmailbuttons-offlineFolder-label");
    var offlineFolderValue = document.getElementById("gmailbuttons-offlineFolder");

    if (this.IsServerGmailIMAP(this.GetMessageServer()) &&
        Services.vc.compare(this.appVersion, "19.0a1") >= 0 &&
        gmailbuttons.extPrefs.getBoolPref("showGmailInfo")) {
      offlineFolderLabel.hidden = false;
      offlineFolderValue.hidden = false;
      var folder = gFolderDisplay.selectedMessage.folder;
      var messageKey = gFolderDisplay.selectedMessage.messageKey;
      var offlineFolder = folder.GetOfflineMsgFolder(messageKey);
      offlineFolderValue.headerValue = offlineFolder ? offlineFolder.onlineName : "???";
    } else {
      offlineFolderLabel.hidden = true;
      offlineFolderValue.hidden = true;
    }
  },

  IssueCommand: function (aMessage, aCommand, aExtraArgs, aUrlListener) {
    var folder = aMessage.folder;
    folder.QueryInterface(Ci.nsIMsgImapMailFolder);

    var uri = folder.issueCommandOnMsgs(aCommand, aMessage.messageKey +
      (aExtraArgs ? " " + aExtraArgs : ""), msgWindow);
    uri.QueryInterface(Ci.nsIMsgMailNewsUrl);
    uri.RegisterListener(aUrlListener);
  },

  // Fetches labels for currently selected message and updates UI
  UpdateLabels : function () {
    try {
      /* remove existing label buttons */
      labelsElement = document.getElementById("gmailbuttons-labels");
      labelsElement.headerValue = null;

      // only show gmail labels if we are in a gmail account
      var labelsRow = document.getElementById("gmailbuttons-labels-row");
      var server = gmailbuttons.GetMessageServer();
      if (gmailbuttons.IsServerGmailIMAP(server) &&
          gmailbuttons.extPrefs.getBoolPref("showGmailLabels")) {

        // first make sure we have special folder map
        if (!gmailbuttons.SpecialFolderMap[server.key]) {
          gmailbuttons.getSpecialFolders(server, gmailbuttons.UpdateLabels);
          return;
        }
        labelsRow.hidden = false;
        if (Services.io.offline) {
          labelsElement.headerValue = "not supported offline";
          return;
        }
        var message = gFolderDisplay.selectedMessage;

        // TODO extract socket stuff to function

        var socket = new gmailbuttonsSocket();

        var onDataReceived1;
        var onDataReceived2;
        var onDataReceived3;
        var onDataReceived3x;
        var onDataReceived4;
        var onDataReceived5;
        var onDataReceived6;

        var folder, specialFolder;

        onDataReceived1 = function (aData) {
          if (typeof aData === "string") {
            // response starts with '* OK'
            if (aData.search(/^\* OK/i) == 0) {
              socket.onDataReceived = onDataReceived2;
              return;
            }
          }
          alert('closing socket1\n\n' + aData);
          socket.disconnect();
        };

        onDataReceived2 = function (aData) {
          if (aData.search(/1 OK/i) >= 0) {
            socket.onDataReceived = onDataReceived3;
            folder = message.folder;
            folder.QueryInterface(Ci.nsIMsgImapMailFolder);
            socket.sendString('2 SELECT "' + folder.onlineName + '"\r\n');
            return;
          }
          if (aData.search(/^\+ /i) == 0) {
            // oauth error - have to send \r\n to get error message
            socket.onDataReceived = onDataReceived3x;
            socket.sendString('\r\n');
            return;
          }
          alert('closing socket2\n\n' + aData);
          socket.disconnect();
        };

        onDataReceived3 = function (aData) {
          if (aData.search(/2 OK/i) >= 0) {
            socket.onDataReceived = onDataReceived4;
            socket.sendString('3 LIST "" "' + folder.onlineName + '"\r\n');
            return;
          }
          alert('closing socket3\n\n' + aData);
          socket.disconnect();
        };

        onDataReceived3x = function (aData) {
          alert("closing socket3x\n\n" + aData);
          socket.disconnect();
        };
  
        onDataReceived4 = function (aData) {
          if (aData.search(/3 OK/i) >= 0) {
            socket.onDataReceived = onDataReceived5;
            // this is one of gmails special folders
            specialFolder = aData.match(gmailbuttons._specialFolderRegex);
            var messageId = message.messageKey + ":" + message.messageKey;
            socket.sendString('4 UID FETCH ' + messageId + ' (X-GM-LABELS)\r\n');
            return;
          }
          alert("closing socket4\n\n" + aData);
          socket.disconnect();
        };

        onDataReceived5 = function (aData) {
          socket.onDataReceived = onDataReceived6;
          // response lines are not always returned together, so we
          // skip looking for the OK and just look for the FETCH
          var labels = aData.match(/FETCH \(X-GM-LABELS \((.*)\).*\)/i);
          if (labels) {
            if (labels.length <= 0) {
              labels = new Array();
            } else {
              // split on spaces that are not within quotes
              // thank you http://stackoverflow.com/a/6464500
              var reg = /[ ](?=(?:[^"\\]*(?:\\.|"(?:[^"\\]*\\.)*[^"\\]*"))*[^"]*$)/g;
              labels = labels[1].split(reg);
            }
            if (specialFolder) {
              labels.unshift("\\" + specialFolder);
            } else {
              labels.unshift(folder.onlineName);
            }
            // Leaving the old Starred match since X-GM-LABELS are "remembered" for old messages.
            var starredPos = labels.indexOf('"\\\\Starred"');
            if (starredPos >= 0) {
              labels.splice(starredPos, 1);
            }
            // remove Flagged since thunderbird ui already handles it in a different way
            // TODO may want to make showing Flagged optional
            var flaggedPos = labels.indexOf('\\\\Flagged');
            if (flaggedPos >= 0) {
              labels.splice(flaggedPos, 1);
            }
          }
          if (!labels) {
            labels = gmailbuttons.strings.getString("gmailbuttons.error");
          }
          labelsElement = document.getElementById("gmailbuttons-labels");
          labelsElement.headerValue = labels;
          socket.disconnect();
        };

        onDataReceived6 = function (aData) {};

        socket.onDataReceived = onDataReceived1;
        socket.connect(server.realHostName, server.port, ["ssl"]);
        socket.onConnection = function () {
          switch (server.authMethod) {
            case Ci.nsMsgAuthMethod.passwordCleartext:
              socket.sendString('1 LOGIN "' + server.realUsername + '" "' +
              server.password.replace('\\', '\\\\').replace('"', '\\"') + '"\r\n');
              break;
            case Ci.nsMsgAuthMethod.OAuth2:
              let oauth = new OAuth2Module(server);
              // https://github.com/dlech/gmailbuttons/issues/34
              // This function is no longer available
              if (!oauth.buildXOAuth2String) {
                break;
              }
              oauth.connect(false, {
                onSuccess(token) {
                  let sasl = oauth.buildXOAuth2String();
                  socket.sendString('1 AUTHENTICATE XOAUTH2 ' + sasl + '\r\n');
                },
                onFailure(msg) {
                  alert("Failed to connect via oauth: " + msg);
                }
              });
              break;
          }
        }
      } else {
        labelsRow.hidden = true;
      }
    } catch (ex) {
      alert(ex);
    }
  },

  // Removes the specified label from the current message
  RemoveLabel : function (aLabel) {
    try {
      // IssueCommand result is returned asyncronously so we have
      // to create a listener to handle the result.
      var urlListener = {
        OnStartRunningUrl: function (aUrl) {
          // don't do anything on start
        },

        OnStopRunningUrl: function (aUrl, aExitCode) {
          gmailbuttons.UpdateLabels();
        }
      };

      var message = gFolderDisplay.selectedMessage;
      var folder = message.folder;
      folder.QueryInterface(Ci.nsIMsgImapMailFolder);
      var onlineName = aLabel;
      // check for special folder
      if (onlineName.indexOf("\\") == 0) {
        onlineName = onlineName.substring(1);
        onlineName = gmailbuttons.SpecialFolderMap[folder.server.key][onlineName].onlineName;
      }
      if (folder.onlineName == onlineName) {
        this.IssueCommand(message, "STORE", "+FLAGS (\\Deleted)", urlListener);
      } else {
        this.IssueCommand(message, "STORE", "-X-GM-LABELS " + aLabel, urlListener);
      }
    } catch (ex) {
      alert(ex);
    }
  },
  
  OfflineStorageLocationColumnHandler : {
    getCellText : function (row, col) {
       var hdr = gDBView.getMsgHdrAt (row);
       var offlineFolder = hdr.folder.GetOfflineMsgFolder (hdr.messageKey);
       return offlineFolder ? offlineFolder.onlineName : "???";
    },
    getSortStringForRow : function (hdr) {
      var offlineFolder = hdr.folder.GetOfflineMsgFolder (hdr.messageKey);
      return offlineFolder ? offlineFolder.onlineName : "???";
    },
    isString:            function() {return true;},
    getCellProperties:   function(row, col, props){},
    getRowProperties:    function(row, props){},
    getImageSrc:         function(row, col) {return null;},
    getSortLongForRow:   function(hdr) {return 0;}
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
