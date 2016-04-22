#!/bin/bash

function usage () {
   cat <<EOF

Usage:
$scriptname [reference] [regression]
example:
compare.sh reference regression

EOF
   exit 0
}

scriptname=$0
reference=$1
regression=$2
threshold=8000

function compareScreenshots {
  for (( i=$1 ; $i < $2; i=$i+1 )); do
    number=`compare -metric AE -fuzz 10% $reference/${files[$i]} $regression/${files[$i]} compare/${files[$i]} 2>&1`
    if [ "$number" -lt "$threshold" ]; then
      echo -n "."
      rm compare/${files[$i]}
    else
      echo -n "F"
    fi
  done
}

function prepareFolders {
  cd $reference
  resolutions=(`find . -mindepth 1 -type d`)
  files=(`find . -name "*.png"`)
  cd ..
  for dir in ${resolutions[@]}; do
    mkdir -p compare/$dir
  done
}

prepareFolders
files_middle=${#files[@]}/2
compareScreenshots 0 $files_middle
compareScreenshots 0 $files_middle &
compareScreenshots $files_middle ${#files[@]} &
wait