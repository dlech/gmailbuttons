
var gmailbuttons = {

  // used to store special folder mappings for each account
  SpecialFolderMap : {},

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
    case "showGmailInfo":
      this.UpdateMessageId();
      this.UpdateThreadId();
      break;
    case "showGmailLabels":
      this.UpdateLabels();
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
    folder.QueryInterface(Ci.nsIMsgImapMailFolder);
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
        spamFolder = gmailbuttons.SpecialFolderMap[server.key]["\\Spam"].imapFolder;
        var thisFolder = gmailbuttons.GetMessageFolder();
        isTrashFolder = trashFolder.URI == thisFolder.URI;
        isSpamFolder = spamFolder.URI == thisFolder.URI;
      } catch (ex) {
        // don't need to do anything here
        //alert(ex);
      }
      /* get label text */
      trashLabel = trashFolder ? trashFolder.prettiestName :
          gmailbuttons.strings.getString("gmailbuttons.error");
      spamLabel = spamFolder ? spamFolder.prettiestName :
          gmailbuttons.strings.getString("gmailbuttons.error");

      /* get tooltip text */
      trashTooltip = trashFolder ?
          gmailbuttons.strings.getFormattedString("gmailbuttons.moveButton.tooltip",
            [trashFolder.URI.replace(serverRootFolder.URI, "").substr(1)], 1) :
          gmailbuttons.strings.getString("gmailbuttons.error");
      spamTooltip = spamFolder ?
          gmailbuttons.strings.getFormattedString("gmailbuttons.moveButton.tooltip",
            [spamFolder.URI.replace(serverRootFolder.URI, "").substr(1)], 1) :
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
      gmailbuttons.UpdateLabels();
      gmailbuttons.UpdateMessageId();
      gmailbuttons.UpdateThreadId();
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

  /** Use XLIST to create map of special folders for specified server.
   * executes (optional) aCallback when finished */
  getSpecialFolders: function (aServer, aCallback) {
    aServer.QueryInterface(Ci.nsIMsgIncomingServer);
    if (!this.SpecialFolderMap[aServer.key]) {
      var newServer = {};
      // TODO extract socket stuff to function
      if (!this.tcpSocket) {
        this.tcpSocket = new (Components.Constructor("@mozilla.org/tcp-socket;1", "nsIDOMTCPSocket"))();
      }
      var socket = this.tcpSocket.open(aServer.realHostName, aServer.port, { useSSL: true });
      socket.ondata = function (aEvent) {
        if (typeof aEvent.data === "string") {
          // response starts with '* OK'
          if (aEvent.data.search(/^\* OK/i) == 0) {
            socket.ondata = function (aEvent) {
              if (aEvent.data.search(/1 OK/i) >= 0) {
                socket.ondata = function (aEvent) {
                  if (aEvent.data.search(/2 OK/i) >= 0) {
                    socket.ondata = null;
                    var lines = aEvent.data.split("\r\n");
                    for (var i = 0; i < lines.length; i++) {
                      var newFolder = {};
                      // this is one of gmails special folders
                      var flag =
                        lines[i].match(/\\Inbox|\\AllMail|\\Draft|\\Sent|\\Spam|\\Starred|\\Trash|\\Important/i);
                      if (flag) {
                        var match = lines[i].match(/XLIST \([^\(]*\) "." "?([^"]*)"?/i);
                        if (match.length > 1) {
                          var folderName = match[1];
                          if (flag == "\\Inbox") {
                            folderName = "INBOX"; // TODO does case matter here?
                          }
                          newFolder.onlineName = folderName;
                          newFolder.imapFolder = aServer.rootFolder.findSubFolder(folderName);
                          newServer[flag] = newFolder;
                        }
                      }
                    }
                    if (Object.keys(newServer).length > 0) {
                      gmailbuttons.SpecialFolderMap[aServer.key] = newServer;
                    }
                    socket.close();
                    if (typeof aCallback === "function") {
                      aCallback.call();
                    }
                  }
                };
                socket.send("2 XLIST \"\" *\r\n");
                return;
              }
              alert("closing socket2\n\n" + aEvent.data);
              socket.close();
            };
            return;
          }
        }
        alert("closing socket1\n\n" + aEvent.data);
        socket.close();
      };
      socket.onopen = function () {
        socket.send("1 LOGIN " + aServer.realUsername + " " + aServer.password + "\r\n");
      }
    }
  },

  // moves the selected message to a special folder. i.e. [Gmail]/Trash
  MoveToSpecialFolder: function (aFlag, aEvent) {

    var
      server,
      specialFolder;

    server = this.GetMessageServer();
    if (this.IsServerGmailIMAP(server)) { // mesage is on Gmail imap server
      specialFolder = this.SpecialFolderMap[server.key][aFlag].imapFolder;
      if (specialFolder) {
        gFolderDisplay.hintAboutToDeleteMessages();
        gDBView.doCommandWithFolder(nsMsgViewCommandType.moveMessages,
          specialFolder);
        //return; // otherwise show error mesage below
      }
    } // trash button should not be visible if not a Gmail imap message
  // TODO may want error message here
  },

  UpdateMessageId: function () {

    var messageIdLabel = document.getElementById("gmailbuttons-messageId-label");
    var messageIdValue = document.getElementById("gmailbuttons-messageId");

    if (this.IsServerGmailIMAP(this.GetMessageServer()) &&
        gmailbuttons.extPrefs.getBoolPref("showGmailInfo")) {
      messageIdLabel.hidden = false;
      messageIdValue.hidden = false;
      messageIdValue.headerValue = gFolderDisplay.selectedMessage.getStringProperty("X-GM-MSGID");
    } else {
      messageIdLabel.hidden = true;
      messageIdValue.hidden = true;
    }
  },

  UpdateThreadId: function () {

    var threadIdLabel = document.getElementById("gmailbuttons-threadId-label");
    var threadIdValue = document.getElementById("gmailbuttons-threadId");

    if (this.IsServerGmailIMAP(this.GetMessageServer()) &&
        gmailbuttons.extPrefs.getBoolPref("showGmailInfo")) {
      threadIdLabel.hidden = false;
      threadIdValue.hidden = false;
      threadIdValue.headerValue =  gFolderDisplay.selectedMessage.getStringProperty("X-GM-THRID");
    } else {
      threadIdLabel.hidden = true;
      threadIdValue.hidden = true;
    }
  },

  FetchCustomAttribute: function (aMessage, aAttribute, aUrlListener) {
    var folder = aMessage.folder;
    folder.QueryInterface(Ci.nsIMsgImapMailFolder);

    var uri = folder.fetchCustomMsgAttribute(aAttribute, aMessage.messageKey,
        msgWindow);
    uri.QueryInterface(Ci.nsIMsgMailNewsUrl);
    uri.RegisterListener(aUrlListener);
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
      var server = this.GetMessageServer();
      if (this.IsServerGmailIMAP(server) &&
          this.extPrefs.getBoolPref("showGmailLabels")) {
        labelsRow.hidden = false;
        var message = gFolderDisplay.selectedMessage;
        // TODO extract socket stuff to function
        if (!this.tcpSocket)
          this.tcpSocket = new (Components.Constructor("@mozilla.org/tcp-socket;1", "nsIDOMTCPSocket"))();
        var socket = this.tcpSocket.open(server.realHostName, server.port, { useSSL: true });
        socket.ondata = function (aEvent) {
          if (typeof aEvent.data === "string") {
            // response starts with '* OK'
            if (aEvent.data.search(/^\* OK/i) == 0) {
              socket.ondata = function (aEvent) {
                if (aEvent.data.search(/1 OK/i) >= 0) {
                  socket.ondata = function (aEvent) {
                    if (aEvent.data.search(/2 OK/i) >= 0) {
                     socket.ondata = function (aEvent) {
                        if (aEvent.data.search(/3 OK/i) >= 0) {
                          socket.ondata = function (aEvent) {
                            socket.ondata = null;
                            // response lines are not always returned together, so we
                            // skip looking for the OK and just look for the FETCH
                            var labels = aEvent.data.match(/FETCH \(X-GM-LABELS \(([^\)]*)\)/i);
                            if (labels) {
                              if (labels.length <= 0) {
                                labels = new Array();
                              } else {
                                // split on spaces that are not within quotes
                                // thank you http://stackoverflow.com/a/6464500
                                reg = /[ ](?=(?:[^"\\]*(?:\\.|"(?:[^"\\]*\\.)*[^"\\]*"))*[^"]*$)/g;
                                labels = labels[1].split(reg);
                              }
                              if (specialFolder) {
                                labels.unshift("\\" + specialFolder);
                              } else {
                                labels.unshift(folder.onlineName);
                              }
                              // remove starred since thunderbird ui already handles it in a different way
                              // TODO may want to make showing Starred optional
                              var starredPos = labels.indexOf("\"\\\\Starred\"");
                              if (starredPos >= 0) {
                                labels.splice(1, starredPos);
                              }
                            }
                            if (!labels) {
                              labels = gmailbuttons.strings.getString("gmailbuttons.error");
                            }
                            labelsElement = document.getElementById("gmailbuttons-labels");
                            labelsElement.headerValue = labels;
                            socket.close();
                          };
                          // this is one of gmails special folders
                          var specialFolder =
                            aEvent.data.match(/\\Inbox|\\AllMail|\\Draft|\\Sent|\\Spam|\\Starred|\\Trash|\\Important/i);
                          var messageId = message.messageKey + ":" + message.messageKey;
                          socket.send("4 UID FETCH " + messageId + " (X-GM-LABELS)\r\n");
                          return;
                        }
                        alert("closing socket4\n\n" + aEvent.data);
                        socket.close();
                      };
                      var messageId = message.messageKey + ":" + message.messageKey;
                      socket.send("3 XLIST \"\" \"" + folder.onlineName + "\"\r\n");
                      return;
                    }
                    alert("closing socket3\n\n" + aEvent.data);
                    socket.close();
                  };
                  var folder = message.folder;
                  folder.QueryInterface(Ci.nsIMsgImapMailFolder);
                  socket.send("2 SELECT \"" + folder.onlineName + "\"\r\n");
                  return;
                }
                alert("closing socket2\n\n" + aEvent.data);
                socket.close();
              };
              return;
            }
          }
          alert("closing socket1\n\n" + aEvent.data);
          socket.close();
        };
        socket.onopen = function () {
          socket.send("1 LOGIN " + server.realUsername + " " + server.password + "\r\n");
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
      // fetchCustomAttribute result is returned asyncronously so we have
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
FolderDisplayListenerManager.registerListener(gmailbuttons.folderDisplayListener);
