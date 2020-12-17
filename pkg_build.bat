npm run build
pkg src/server/index.js --targets win-x64  --output ShiguReader.exe

cd ..
mkdir ShiguReader_Portable

mv ShiguReader/ShiguReader.exe ShiguReader_Portable 

robocopy ShiguReader/dist ShiguReader_Portable/dist  
robocopy ShiguReader/public ShiguReader_Portable/public 
robocopy ShiguReader/resource ShiguReader_Portable/resource 

cp ShiguReader/path-config.ini ShiguReader_Portable 
cp ShiguReader/etc-config.ini ShiguReader_Portable 
cp ShiguReader/move-path-config.ini ShiguReader_Portable 


cp ShiguReader/README.md ShiguReader_Portable 
cp ShiguReader/README_English.md ShiguReader_Portable 

一个exe
两个readme
三个ini
三个folder
