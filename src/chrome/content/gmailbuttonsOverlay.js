const {Socket} = ChromeUtils.import("resource:///modules/socket.jsm");

const OAuth2Module = Components.Constructor("@mozilla.org/mail/oauth2-module;1",
                                            "msgIOAuth2Module", "initFromMail");

function gmailbuttonsSocket() {}
gmailbuttonsSocket.prototype = {
  __proto__ : Socket,
  log(string) {
    if (string == 'onStartRequest' || string.indexOf('onStopRequest') == 0 ||
        string.indexOf('onTransportStatus') == 0) {
      return;
    }
    //alert(string);
  }
}

const gmailbuttons = {

  // These flags come from the GMail IMAP API and are based on RFC 6154
  _specialFolderRegex : /\\Inbox|\\All|\\Important|\\Drafts|\\Flagged|\\Junk|\\Sent|\\Trash/i,

  // used to store special folder mappings for each account
  SpecialFolderMap : {},

  onLoad() {
    // initialization code
    this.initialized = true;
    this.strings = Services.strings.createBundle("chrome://gmailbuttons/locale/gmailbuttonsOverlay.properties");

    // get Thunderbird app version
    this.appVersion = Services.appinfo.version;

    // add support for preferences
    this.extPrefs = Services.prefs.getBranch("extensions.gmailbuttons.");
    this.extPrefs.addObserver("", this, false);

    Services.obs.addObserver(this, "network:offline-status-changed", false);
        
    Services.obs.addObserver(gmailbuttons.CreateDbObserver, "MsgCreateDBView", false);
  },

  onUnload() {
    // cleanup preferences
    this.extPrefs.removeObserver("", this);
  },

  observe(subject, topic, data) {
    switch (topic) {
      case "nsPref:changed":
        switch (data) {
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
        if (data == "online") {
          for (let server in this.SpecialFolderMap) {
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
    observe(msgFolder, topic, data)
    {  
       gDBView.addColumnHandler("gmailbuttons-offline-storage-column",
          gmailbuttons.OfflineStorageLocationColumnHandler);
    }
  },

  GetMessageFolder() {
    // get current message
    const header = gFolderDisplay.selectedMessage;
    // give up if no message selected or this is a dummy header
    if (!header || gMessageDisplay.isDummy) {
      return;
    }
    // get folder that contains message
    const folder = header.folder;
    if (!folder) { // message not in folder somehow?
      return;
    }
    folder.QueryInterface(Ci.nsIMsgFolder);
    return folder;
  },

  GetMessageServer() {
    const folder = this.GetMessageFolder();
    if (!folder) { // message not in folder somehow?
      return;
    }
    // get server that hosts folder
    const server = folder.server;
    if (!server) { // folder does not have server?
      return;
    }
    return server;
  },

  // returns true if message is in Gmail imap
  IsServerGmailIMAP(server) {
    // check that server parameter is valid
    if (!(server instanceof Ci.nsIImapIncomingServer)) {
      return;
    }
    // check to see if it is imap and Gmail server
    // TODO - pull these to a config file
    const gmailHostNames = ["imap.gmail.com", "imap.googlemail.com"];
    // built-in isGMailServer function is broken in German version
    // of Thunderbird so we check the host name as well
    return (server.type == "imap" && server.isGMailServer) ||
      (gmailHostNames.indexOf(server.hostName) >= 0);
  },

  updateJunkSpamButtons() {
    /* get message-specific header buttons */
    const deleteButton = document.getElementById("hdrTrashButton");
    const trashButton = document.getElementById("gmailbuttons-trash-button");
    const junkButton = document.getElementById("hdrJunkButton");
    const spamButton = document.getElementById("gmailbuttons-spam-button");

    const server = gmailbuttons.GetMessageServer();

    if (gmailbuttons.IsServerGmailIMAP(server)) {
      // this is a Gmail imap account

      if (!gmailbuttons.SpecialFolderMap[server.key]) {
        gmailbuttons.getSpecialFolders(server, gmailbuttons.updateJunkSpamButtons);
        return;
      }

      // also look at mail.server prefs
      const serverPrefs = Components.classes["@mozilla.org/preferences-service;1"]
          .getService(Components.interfaces.nsIPrefService)
          .getBranch("mail.server." + server.key + ".");
      /* get actual folder names from server  */
      let serverRootFolder, trashFolder, spamFolder, isTrashFolder, isSpamFolder;
      try {
        serverRootFolder = server.rootFolder;
        trashFolder = gmailbuttons.SpecialFolderMap[server.key]["\\Trash"].imapFolder;
        spamFolder = gmailbuttons.SpecialFolderMap[server.key]["\\Junk"].imapFolder;
        const thisFolder = gmailbuttons.GetMessageFolder();
        isTrashFolder = trashFolder.URI == thisFolder.URI;
        isSpamFolder = spamFolder.URI == thisFolder.URI;
      } catch (ex) {
        // don't need to do anything here
        //alert(ex);
      }
      /* get label text */
      const trashLabel = trashFolder ? trashFolder.prettyName :
          gmailbuttons.strings.GetStringFromName("gmailbuttons.error");
      const spamLabel = spamFolder ? spamFolder.prettyName :
          gmailbuttons.strings.GetStringFromName("gmailbuttons.error");
      const notSpamLabel = spamFolder ?
          gmailbuttons.strings.formatStringFromName("gmailbuttons.notButton",
            [ spamFolder.prettyName ], 1) :
          gmailbuttons.strings.GetStringFromName("gmailbuttons.error");

      /* get tooltip text */
      const trashTooltip = trashFolder ?
          gmailbuttons.strings.formatStringFromName("gmailbuttons.moveButton.tooltip",
            [trashFolder.URI.replace(serverRootFolder.URI, "").substr(1)], 1) :
          gmailbuttons.strings.GetStringFromName("gmailbuttons.error");
      const spamTooltip = spamFolder ?
          gmailbuttons.strings.formatStringFromName("gmailbuttons.moveButton.tooltip",
            [spamFolder.URI.replace(serverRootFolder.URI, "").substr(1)], 1) :
          gmailbuttons.strings.GetStringFromName("gmailbuttons.error");
      const notSpamTooltip = spamFolder ?
          gmailbuttons.strings.formatStringFromName("gmailbuttons.moveButton.tooltip",
            [ "INBOX" ], 1) :
          gmailbuttons.strings.GetStringFromName("gmailbuttons.error");

      if (deleteButton) {
        // save the original tooltip - this only runs once
        if (!deleteButton.oldTooltipText) {
          deleteButton.oldTooltipText = deleteButton.tooltipText;
        }
        // apply new tooltip
        if (isTrashFolder || isSpamFolder) {
          deleteButton.tooltipText = gmailbuttons.strings.GetStringFromName(
            "gmailbuttons.deleteButton.trashSpam.tooltip"
          );
        } else {
          deleteButton.tooltipText = gmailbuttons.strings.GetStringFromName(
            "gmailbuttons.deleteButton.regular.tooltip"
          );
        }

        try {
          const showDelete = gmailbuttons.extPrefs.getBoolPref("showDeleteButton");
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
        spamButton.oncommand = () => {};
      }
    }
  },

  // unhides all buttons - used during customization of toolbar
  showAllButtons() {
    // get message-specific header buttons
    const deleteButton = document.getElementById("hdrTrashButton");
    const trashButton = document.getElementById("gmailbuttons-trash-button");
    const junkButton = document.getElementById("hdrJunkButton");
    const spamButton = document.getElementById("gmailbuttons-spam-button");

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
    onStartHeaders() {
      // do nothing
    },

    onEndHeaders() {
      gmailbuttons.updateJunkSpamButtons();
      gmailbuttons.UpdateLabels();
      gmailbuttons.UpdateMessageId();
      gmailbuttons.UpdateThreadId();
      gmailbuttons.UpdateOfflineFolder();
    },

    onEndAttachments() {
      // do nothing
    }
  },

  onBeforeCustomization(data) {
    if (data.target.id == "header-view-toolbox") {
      gmailbuttons.showAllButtons();
    }
  },

  onAfterCustomization(data) {
    if (data.target.id == "header-view-toolbox") {
      gmailbuttons.updateJunkSpamButtons();
    }
  },

  /** Use LIST to create map of special folders for specified server.
   * executes (optional) aCallback when finished */
  getSpecialFolders(server, callback) {

    server.QueryInterface(Ci.nsIMsgIncomingServer);
    if (!gmailbuttons.SpecialFolderMap[server.key]) {
      const newServer = {};

      // if we are offline, we only fetch the minimum flags needed for trash
      // and spam buttons. This will be cleared when we go back online.
      if (Services.io.offline) {
        const xlistInbox = 0x4000;
        const xlistTrashFlag = 0x10000;
        const xlistSpamFlag = 0x1000;
        const recursiveSearch = (folder, flag) => {
          folder.QueryInterface(Ci.nsIMsgImapMailFolder);
          if (folder.boxFlags & flag) {
            return folder;
          }
          if (folder.hasSubFolders) {
            const subfolders = folder.subFolders;
            while (subfolders.hasMoreElements()) {
              const subfolder = subfolders.getNext();
              const result = recursiveSearch(subfolder, flag);
              if (result) {
                return result;
              }
            }
          }
        };
        const inboxFolder = {}
        inboxFolder.imapFolder = recursiveSearch(server.rootFolder, xlistInbox);
        inboxFolder.onlineName = inboxFolder.imapFolder.onlineName;
        newServer["\\Inbox"] = inboxFolder;
        const trashFolder = {};
        trashFolder.imapFolder = recursiveSearch(server.rootFolder, xlistTrashFlag);
        trashFolder.onlineName = trashFolder.imapFolder.onlineName;
        newServer["\\Trash"] = trashFolder;
        const spamFolder = {};
        spamFolder.imapFolder = recursiveSearch(server.rootFolder, xlistSpamFlag);
        spamFolder.onlineName = spamFolder.imapFolder.onlineName;
        newServer["\\Junk"] = spamFolder;

        gmailbuttons.SpecialFolderMap[server.key] = newServer;
        if (typeof callback === "function") {
          callback.call();
        }
        return;
      }

      // If we are online, we use LIST

      // INBOX always exists, so don't need to use LIST for it.
      // This saves us from having to call LIST twice
      const inboxFolder = {}
      inboxFolder.imapFolder = server.rootFolder.findSubFolder ("INBOX");
      inboxFolder.onlineName = inboxFolder.imapFolder.onlineName;
      newServer["\\Inbox"] = inboxFolder;


      // TODO extract socket stuff to function
      const socket = new gmailbuttonsSocket(this);

      let onDataReceived1;
      let onDataReceived2;
      let onDataReceived3;
      let onDataReceived3x;
      let onDataReceived4;

      onDataReceived1 = data => {
        if (typeof data === "string") {
          // response starts with '* OK'
          if (data.search(/^\* OK/i) == 0) {
            socket.onDataReceived = onDataReceived2;
            return;
          }
        }
        alert("closing socket1\n\n" + data);
        socket.disconnect();
      };

      onDataReceived2 = data => {
        if (data.search(/1 OK/i) >= 0) {
          socket.onDataReceived = onDataReceived3;
          // Add [GMail]/* special folders are at the second level. Using '%'
          // wildcard for the first level the first level as well since I think
          // some locations have [googlemail] possibly?
          socket.sendString('2 LIST "" %/%\r\n');
          return;
        }
        if (data.search(/^\+ /i) == 0) {
          // oauth error - have to send \r\n to get error message
          socket.onDataReceived = onDataReceived3x;
          socket.sendString('\r\n');
          return;
        }
        alert("closing socket2\n\n" + data);
        socket.disconnect();
      };

      onDataReceived3 = data => {
        if (data.search(/2 OK/i) >= 0) {
          socket.onDataReceived = onDataReceived4;
          const lines = data.split("\r\n");
          for (let i = 0; i < lines.length; i++) {
            const newFolder = {};
            const flag = lines[i].match(gmailbuttons._specialFolderRegex);
            if (flag) {
              const match = lines[i].match(/LIST \([^\(]*\) "." "?([^"]*)"?/i);
              if (match.length > 1) {
                const folderName = match[1];
                newFolder.onlineName = folderName;
                newFolder.imapFolder = server.rootFolder.findSubFolder(folderName);
                newServer[flag] = newFolder;
              }
            }
          }
          if (Object.keys(newServer).length > 0) {
            gmailbuttons.SpecialFolderMap[server.key] = newServer;
          }
          socket.disconnect();
          if (typeof callback === "function") {
            callback.call();
          }
        }
      };

      onDataReceived3x = data => {
        alert("closing socket3x\n\n" + data);
        socket.disconnect();
      };

      onDataReceived4 = data => {};

      socket.onDataReceived = onDataReceived1;
      socket.connect(server.realHostName, server.port, ["ssl"]);
      socket.onConnection = () => {
        switch (server.authMethod) {
        case Ci.nsMsgAuthMethod.passwordCleartext:
          socket.sendString('1 LOGIN "' + server.realUsername + '" "' +
              server.password.replace('\\', '\\\\').replace('"', '\\"') + '"\r\n');
          break;
        case Ci.nsMsgAuthMethod.OAuth2:
          const oauth = new OAuth2Module(server);
          if (!oauth.initFromMail(server)) {
            alert("GMailButtons OAuth failed to init");
            break;
          }
          oauth.connect(true, {
            onSuccess(token) {
              socket.sendString('1 AUTHENTICATE XOAUTH2 ' + token + '\r\n');
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
  MoveToSpecialFolder(flag, data) {
    const server = gmailbuttons.GetMessageServer();
    if (gmailbuttons.IsServerGmailIMAP(server)) { // message is on Gmail imap server
      const specialFolder = gmailbuttons.SpecialFolderMap[server.key][flag].imapFolder;
      if (specialFolder) {
        gFolderDisplay.hintAboutToDeleteMessages();
        gDBView.doCommandWithFolder(Ci.nsMsgViewCommandType.moveMessages,
          specialFolder);
        //return; // otherwise show error message below
      }
    } // trash button should not be visible if not a Gmail imap message
  // TODO may want error message here
  },

  UpdateMessageId() {
    const messageIdLabel = document.getElementById("gmailbuttons-messageId-label");
    const messageIdValue = document.getElementById("gmailbuttons-messageId");

    if (gmailbuttons.IsServerGmailIMAP(gmailbuttons.GetMessageServer()) &&
        Services.vc.compare(gmailbuttons.appVersion, "17.0b1") >= 0 &&
        gmailbuttons.extPrefs.getBoolPref("showGmailInfo")) {
      messageIdLabel.hidden = false;
      messageIdValue.hidden = false;
      const msgId = gFolderDisplay.selectedMessage.getStringProperty("X-GM-MSGID");
      messageIdValue.headerValue = (msgId && msgId.length > 0) ? msgId : '???';
    } else {
      messageIdLabel.hidden = true;
      messageIdValue.hidden = true;
    }
  },

  UpdateThreadId() {
    const threadIdLabel = document.getElementById("gmailbuttons-threadId-label");
    const threadIdValue = document.getElementById("gmailbuttons-threadId");

    if (gmailbuttons.IsServerGmailIMAP(gmailbuttons.GetMessageServer()) &&
        Services.vc.compare(gmailbuttons.appVersion, "17.0b1") >= 0 &&
        gmailbuttons.extPrefs.getBoolPref("showGmailInfo")) {
      threadIdLabel.hidden = false;
      threadIdValue.hidden = false;
      const theadId = gFolderDisplay.selectedMessage.getStringProperty("X-GM-THRID");
      threadIdValue.headerValue = (theadId && theadId.length > 0) ? theadId : '???';
    } else {
      threadIdLabel.hidden = true;
      threadIdValue.hidden = true;
    }
  },

  UpdateOfflineFolder() {
    const offlineFolderLabel = document.getElementById("gmailbuttons-offlineFolder-label");
    const offlineFolderValue = document.getElementById("gmailbuttons-offlineFolder");

    if (this.IsServerGmailIMAP(this.GetMessageServer()) &&
        Services.vc.compare(this.appVersion, "19.0a1") >= 0 &&
        gmailbuttons.extPrefs.getBoolPref("showGmailInfo")) {
      offlineFolderLabel.hidden = false;
      offlineFolderValue.hidden = false;
      const folder = gFolderDisplay.selectedMessage.folder;
      const messageKey = gFolderDisplay.selectedMessage.messageKey;
      const offlineFolder = folder.GetOfflineMsgFolder(messageKey);
      offlineFolderValue.headerValue = offlineFolder ? offlineFolder.onlineName : "???";
    } else {
      offlineFolderLabel.hidden = true;
      offlineFolderValue.hidden = true;
    }
  },

  IssueCommand(message, command, extraArgs, urlListener) {
    const folder = message.folder;
    folder.QueryInterface(Ci.nsIMsgImapMailFolder);

    const uri = folder.issueCommandOnMsgs(command, message.messageKey +
      (extraArgs ? " " + extraArgs : ""), msgWindow);
    uri.QueryInterface(Ci.nsIMsgMailNewsUrl);
    uri.RegisterListener(urlListener);
  },

  // Fetches labels for currently selected message and updates UI
  UpdateLabels() {
    try {
      /* remove existing label buttons */
      labelsElement = document.getElementById("gmailbuttons-labels");
      labelsElement.headerValue = null;

      // only show gmail labels if we are in a gmail account
      const labelsRow = document.getElementById("gmailbuttons-labels-row");
      const server = gmailbuttons.GetMessageServer();
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
        const message = gFolderDisplay.selectedMessage;

        // TODO extract socket stuff to function

        const socket = new gmailbuttonsSocket();

        let onDataReceived1;
        let onDataReceived2;
        let onDataReceived3;
        let onDataReceived3x;
        let onDataReceived4;
        let onDataReceived5;
        let onDataReceived6;

        let folder, specialFolder;

        onDataReceived1 = data => {
          if (typeof data === "string") {
            // response starts with '* OK'
            if (data.search(/^\* OK/i) == 0) {
              socket.onDataReceived = onDataReceived2;
              return;
            }
          }
          alert('closing socket1\n\n' + data);
          socket.disconnect();
        };

        onDataReceived2 = data => {
          if (data.search(/1 OK/i) >= 0) {
            socket.onDataReceived = onDataReceived3;
            folder = message.folder;
            folder.QueryInterface(Ci.nsIMsgImapMailFolder);
            socket.sendString('2 SELECT "' + folder.onlineName + '"\r\n');
            return;
          }
          if (data.search(/^\+ /i) == 0) {
            // oauth error - have to send \r\n to get error message
            socket.onDataReceived = onDataReceived3x;
            socket.sendString('\r\n');
            return;
          }
          alert('closing socket2\n\n' + data);
          socket.disconnect();
        };

        onDataReceived3 = data => {
          if (data.search(/2 OK/i) >= 0) {
            socket.onDataReceived = onDataReceived4;
            socket.sendString('3 LIST "" "' + folder.onlineName + '"\r\n');
            return;
          }
          alert('closing socket3\n\n' + data);
          socket.disconnect();
        };

        onDataReceived3x = data => {
          alert("closing socket3x\n\n" + data);
          socket.disconnect();
        };
  
        onDataReceived4 = data => {
          if (data.search(/3 OK/i) >= 0) {
            socket.onDataReceived = onDataReceived5;
            // this is one of gmails special folders
            specialFolder = data.match(gmailbuttons._specialFolderRegex);
            const messageId = message.messageKey + ":" + message.messageKey;
            socket.sendString('4 UID FETCH ' + messageId + ' (X-GM-LABELS)\r\n');
            return;
          }
          alert("closing socket4\n\n" + data);
          socket.disconnect();
        };

        onDataReceived5 = data => {
          socket.onDataReceived = onDataReceived6;
          // response lines are not always returned together, so we
          // skip looking for the OK and just look for the FETCH
          let labels = data.match(/FETCH \(X-GM-LABELS \((.*)\).*\)/i);
          if (labels) {
            if (labels.length <= 0) {
              labels = new Array();
            } else {
              // split on spaces that are not within quotes
              // thank you http://stackoverflow.com/a/6464500
              const reg = /[ ](?=(?:[^"\\]*(?:\\.|"(?:[^"\\]*\\.)*[^"\\]*"))*[^"]*$)/g;
              labels = labels[1].split(reg);
            }
            if (specialFolder) {
              labels.unshift("\\" + specialFolder);
            } else {
              labels.unshift(folder.onlineName);
            }
            // Leaving the old Starred match since X-GM-LABELS are "remembered" for old messages.
            const starredPos = labels.indexOf('"\\\\Starred"');
            if (starredPos >= 0) {
              labels.splice(starredPos, 1);
            }
            // remove Flagged since thunderbird ui already handles it in a different way
            // TODO may want to make showing Flagged optional
            const flaggedPos = labels.indexOf('\\\\Flagged');
            if (flaggedPos >= 0) {
              labels.splice(flaggedPos, 1);
            }
          }
          if (!labels) {
            labels = gmailbuttons.strings.GetStringFromName("gmailbuttons.error");
          }
          labelsElement = document.getElementById("gmailbuttons-labels");
          labelsElement.headerValue = labels;
          socket.disconnect();
        };

        onDataReceived6 = data => {};

        socket.onDataReceived = onDataReceived1;
        socket.connect(server.realHostName, server.port, ["ssl"]);
        socket.onConnection = () => {
          switch (server.authMethod) {
            case Ci.nsMsgAuthMethod.passwordCleartext:
              socket.sendString('1 LOGIN "' + server.realUsername + '" "' +
              server.password.replace('\\', '\\\\').replace('"', '\\"') + '"\r\n');
              break;
            case Ci.nsMsgAuthMethod.OAuth2:
              const oauth = new OAuth2Module(server);
              if (!oauth.initFromMail(server)) {
                alert("GMailButtons OAuth failed to init");
                break;
              }
              oauth.connect(false, {
                onSuccess(token) {
                  socket.sendString('1 AUTHENTICATE XOAUTH2 ' + token + '\r\n');
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
  RemoveLabel(label) {
    try {
      // IssueCommand result is returned asyncronously so we have
      // to create a listener to handle the result.
      const urlListener = {
        OnStartRunningUrl(url) {
          // don't do anything on start
        },

        OnStopRunningUrl(url, exitCode) {
          gmailbuttons.UpdateLabels();
        }
      };

      const message = gFolderDisplay.selectedMessage;
      const folder = message.folder;
      folder.QueryInterface(Ci.nsIMsgImapMailFolder);
      const onlineName = label;
      // check for special folder
      if (onlineName.indexOf("\\") == 0) {
        onlineName = onlineName.substring(1);
        onlineName = gmailbuttons.SpecialFolderMap[folder.server.key][onlineName].onlineName;
      }
      if (folder.onlineName == onlineName) {
        this.IssueCommand(message, "STORE", "+FLAGS (\\Deleted)", urlListener);
      } else {
        this.IssueCommand(message, "STORE", "-X-GM-LABELS " + label, urlListener);
      }
    } catch (ex) {
      alert(ex);
    }
  },
  
  OfflineStorageLocationColumnHandler : {
    getCellText(row, col) {
      const hdr = gDBView.getMsgHdrAt (row);
      const offlineFolder = hdr.folder.GetOfflineMsgFolder (hdr.messageKey);
      return offlineFolder ? offlineFolder.onlineName : "???";
    },
    getSortStringForRow(hdr) {
      const offlineFolder = hdr.folder.GetOfflineMsgFolder (hdr.messageKey);
      return offlineFolder ? offlineFolder.onlineName : "???";
    },
    isString() {
      return true;
    },
    getCellProperties(row, col, props) {},
    getRowProperties(row, props) {},
    getImageSrc(row, col) {
      return null;
    },
    getSortLongForRow(hdr) {
      return 0;
    }
  }
};

// listen for initial window load event
window.addEventListener("load", () => { gmailbuttons.onLoad(); }, false);
// listen for window unload event
window.addEventListener("unload", () => { gmailbuttons.onUnload(); },
  false);
// listen for customization events
window.addEventListener("beforecustomization",
  e => { gmailbuttons.onBeforeCustomization(e); }, false);
window.addEventListener("aftercustomization",
  e => { gmailbuttons.onAfterCustomization(e); }, false);
// listen for messages loading
gMessageListeners.push(gmailbuttons.messageListener);
