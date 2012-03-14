var urlListener = {
  OnStartRunningUrl: function (aUrl) {
    
  },
  OnStopRunningUrl: function (aUrl, aExitCode) {
    aUrl.QueryInterface(Ci.nsIImapUrl);
    alert("Url:\n" + decodeURI(aUrl.spec) +
    "\n\nResult: " + aUrl.customAttributeToFetch + 
    "\n> " + aUrl.customAttributeResult +
    "\n\nExitCode:\n" + aExitCode);
  },
};

var message = gFolderDisplay.selectedMessage;
if (!message) {
  alert("Select a message and run again.");
}
var folder = message.folder;
folder.QueryInterface(Ci.nsIMsgImapMailFolder);
attribute = "X-GM-LABELS";
msgIdList = message.messageKey;
var uri = folder.fetchCustomMsgAttribute(attribute, msgIdList, msgWindow);
uri.QueryInterface(Ci.nsIMsgMailNewsUrl);
uri.RegisterListener(urlListener);