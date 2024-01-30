#!/bin/bash
# git分支的备份
today=$(date '+%Y-%m-%d')
git stash
git checkout test
git fetch -a
# 删除本地的backup分支
local_branchs=$(git branch --list | grep -v '\->')
for branch in $local_branchs;do
  if [[ "$branch" == "backup/$today"* ]]; then
    echo "即将删除本地备份分支$branch"
    git branch -D $branch
    # 不建议批量删除远程备份分支
    # git push origin --delete $branch
  fi
done