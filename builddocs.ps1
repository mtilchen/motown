& C:\Users\Matthew\Downloads\jsduck-3.11.0.exe --head-html='<link rel=\"stylesheet\" href=\"resources/css/motown-docs.css\" type=\"text/css\">' --categories .\doc-src\doc-categories.json --title "Motown" --output .\doc .\motown.js

cp -r -force .\doc-src\resources .\doc\
cp -r -force .\doc\* ..\motowndoc