#!/bin/bash
# git分支的备份
today=$(date '+%Y-%m-%d')
git stash
# git checkout -b `git/crud/$today`
git fetch -a
echo -n "备份${today}的所有分支：" >> branch_list.txt

all_branches=$(git branch -r | grep -v 'backup' | grep -v '\->')
for branch in $all_branches;do
  if [[ $branch != "backup"* ]]; then
    local_branch="${branch#origin/}"
    if ! git show-ref --quiet --verify "refs/heads/$local_branch";then
      git branch --track "$local_branch" "$branch"
    fi
    backup_branch="backup/$today/$local_branch"
    if ! git show-ref --quiet --verify "refs/heads/$backup_branch";then
      echo "$backup_branch" >> branch_list.txt
      git branch --track "$backup_branch" "$branch"
    fi
  fi
done

echo "${today}的所有分支已备份完毕" >> branch_list.txt

