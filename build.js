/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 * 
 *  File:               build.js
 *  Description:        Build script for Mozilla extensions
 *  Author:             David Lechner (gismho@gmail.com)
 * 
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
 

// TODO add test for windows vs. other(*nix) 
if (true) {
  /* Windows build script */
  
  // change these if needed
  var sourceFolder = "src";
  var targetFolder = "dist";

  // create file system object
  var fso = new ActiveXObject("Scripting.FileSystemObject");
  // get full path names from relitive paths
  sourceFolder = fso.GetAbsolutePathName(sourceFolder);
  installRdf = sourceFolder + "\\install.rdf";
  targetFolder = fso.GetAbsolutePathName(targetFolder);
  
  /* get info from install.rdf */
  // create xml doc  
  var xmlDoc = new ActiveXObject("Msxml2.DOMDocument.3.0");
  xmlDoc.async = false;
  // load rinstall.rdf
  if (!xmlDoc.load(installRdf)) {
    // message and quit on error
	WScript.echo("Could not load " + installRdf);
	WScript.quit();
  }
  // get package name
  targetName = xmlDoc.selectSingleNode("//RDF//Description//em:id").text;
  // trim "@name.domain"
  targetName = targetName.substr(0, targetName.indexOf("@"));
  // append version number
  targetName += "_v";
  targetName += xmlDoc.selectSingleNode("//RDF//Description//em:version").text;
  
  // get file names for output files
  targetZip = targetFolder + "\\" + targetName + ".zip";
  targetXpi = targetFolder + "\\" + targetName + ".xpi";
  
  // delete existing target folder to get rid of old files
  if (fso.FolderExists(targetFolder)) {
    fso.DeleteFolder(targetFolder);
  }
  // create new empty folder
  fso.CreateFolder(targetFolder);
  
  // create empty zip file
  var zip = fso.OpenTextFile(targetZip, 2, true)
  zip.Write(String.fromCharCode(80, 75, 5, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0));
  zip.Close();
  // cleanup file object
  zip = null;
  // give file time to close
  WScript.Sleep(500);  
  
  // get windows shell object
  var objApp = new ActiveXObject("Shell.Application");
  // copy source directory into zip  
  objApp.NameSpace(targetZip).CopyHere(objApp.NameSpace(sourceFolder).Items());
 
  // not sure why this is needed, but files will not be 
  // created in zip if we do not sleep here.
  WScript.sleep(250);
  
  // rename .zip to .xpi
  fso.MoveFile(targetZip, targetXpi);
  
  // clean up shell object
  objApp = null;
  // clean up file systm object
  fso = null;
} else {
  // TODO *nix command line to create .xpi file
}