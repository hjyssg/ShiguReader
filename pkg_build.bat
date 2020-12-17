npm run build
pkg src/server/index.js --targets win-x64  --output ShiguReader.exe

cd ..
mkdir ShiguReader_Portable

mv ShiguReader/ShiguReader.exe ShiguReader_Portable 

robocopy ShiguReader/dist ShiguReader_Portable/dist  /e
robocopy ShiguReader/public ShiguReader_Portable/public /e
robocopy ShiguReader/resource ShiguReader_Portable/resource /e

cp ShiguReader/path-config.ini ShiguReader_Portable 
cp ShiguReader/etc-config.ini ShiguReader_Portable 
cp ShiguReader/move-path-config.ini ShiguReader_Portable 


cp ShiguReader/README.md ShiguReader_Portable 
cp ShiguReader/README_English.md ShiguReader_Portable 


