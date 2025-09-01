
cd ..
mkdir ShiguReader_Portable

mv ShiguReader/ShiguReader.exe ShiguReader_Portable 

robocopy ShiguReader/dist ShiguReader_Portable/dist  
robocopy ShiguReader/public ShiguReader_Portable/public 
robocopy ShiguReader/resource ShiguReader_Portable/resource 

cp ShiguReader/config-path.ini ShiguReader_Portable 
cp ShiguReader/config-etc.ini ShiguReader_Portable 

cp ShiguReader/node_modules/_sqlite3@5.0.0@sqlite3/lib/binding/napi-v3-win32-x64/node_sqlite3.node   ShiguReader_Portable 

cp ShiguReader/README.md ShiguReader_Portable 
cp ShiguReader/README_English.md ShiguReader_Portable 

