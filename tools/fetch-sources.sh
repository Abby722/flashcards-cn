#!/bin/sh
# Downloads the two source dictionaries into tools/sources/ (not committed).
set -e
cd "$(dirname "$0")"
mkdir -p sources
curl -L -o sources/complete.min.json https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/main/complete.min.json
curl -L -o sources/handedict.u8 https://raw.githubusercontent.com/gugray/HanDeDict/master/handedict.u8
echo "Sources ready. Now run: node build-lex.js"
