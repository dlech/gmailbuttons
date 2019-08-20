var urlListener = {
  OnStartRunningUrl(url) {
    
  },
  OnStopRunningUrl(url, exitCode) {
    url.QueryInterface(Ci.nsIImapUrl);
    alert("Url:\n" + decodeURI(url.spec) +
    "\n\nResult: " + url.customAttributeResult +
    "\n\nExitCode:\n" + exitCode);
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