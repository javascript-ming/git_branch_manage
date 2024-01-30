# !/usr/bin/bash # windows
declare -a branches
is_valid_number=false
is_support_dialog=false

# 如果本地没有全量分支，可以一次性拉取所有分支
# branchesAtRemote=$(git branch -r)
# for branch in "$branchesAtRemote"; do
#     git branch --track "${branch#origin/}" "$branch"
#     git pull --no-edit origin "${branch#origin/}"
# done

# git分支的备份
# git branch --format="%(refname:short)" > branch_list.txt
# while IFS= read -r branch;
# do
#   git branch "backup/$(date '+%Y-%m-%d')/$branch" "$branch"
# done <<< "$(cat branch_list.txt)"
# # 推送远端
# git add branch_list.txt
# git commit -m "feat: 新增备份文件&备份分支"
# git push origin --all
# 确定日期
#安装dialog插件后可以手动选择截止日期；否则手动输入
if command -v dialog >/dev/null 2>&1
then
  # 显示日历选择器对话框
  # --date-format "%Y-%m-%d"
  selected_date=$(dialog --title "时间选择" --clear --date-format -- "%Y-%m-%d" --calendar "请选择截止日期" 0 0 2>&1 >/dev/tty)
  # 读取用户选择的日期
  exitstatus=$?
  unix_select_date=$(date -d $selected_date +%s) # not mac，mac need run brew install coreutils in mac
  # unix_select_date=$(date -v -"$selected_date"d +%s) # mac 
  # 打印选择的日期
  echo "您选择的日期是: $unix_select_date"
else
  while [ "$is_valid_number" = false ]
  do
    read -p "你想删除多少天以前的分支：" input
    # 使用正则表达式匹配数字模式
    if [[ $input =~ ^[0-9]+$ ]]; then
        is_valid_number=true
        unix_select_date=$(date -d "-$input days" +%s) # not mac need install coreutils in mac
        # unix_select_date=$(date -v -"$input"d +%s)

        # 打印选择的日期
        echo "您选择的日期是: $unix_select_date"
    else
        echo "输入不是一个数字，请重新输入你想删除多少天以前的分支："
    fi
  done
fi

# 列出所有已合并 master的本地和远端分支
# 删除方案1：预拉取所有分支后只展示本地分支，删除本地分支前先判断有无track的远端分支，有则都删除，无则删除本地
# 删除方案2：展示本地和远端的分支，手动确认
# --merged master 
# --no-merged production
# refname:short 避免分别展示本地和远端已经track的分支
# 展示的类型 refs/remotes refs/heads refs/tags
# committerdate authordate
 # 只展示本地分支
merged_master_branch_info=$(git for-each-ref --merged master --format='%(refname:short) %(objectname:short) %(authordate:unix) %(committerdate:unix)' refs/heads)
# 展示本地分支和远端分支
# merged_master_branch_info=$(git for-each-ref --merged master --format='%(refname:short) %(objectname:short) %(committerdate:unix)' refs/remotes refs/heads)
# 展示tag标签
# merged_master_branch_info=$(git for-each-ref --merged master --format='%(refname:short) %(objectname:short) %(committerdate:unix)' refs/tags)

# 遍历分支信息并打印
while IFS= read -r line
do
  # 将每行分支信息拆分为分支名、提交哈希和作者日期
  read -r branch commit_hash authordate committerdate <<< "$line"
  # 打印分支名和作者日期  
  # echo "$author_date \\ $committerdate"
  if [[ $committerdate -le $unix_select_date ]]; then
    # dialog的checklist语法要求每个选项 => `tag desciption 是否选中`
    branches=(${branches[@]} $branch $commit_hash ON)
  fi
  # echo $branches
done <<< "$merged_master_branch_info"

# echo ${#branches[@]}

if [[ ${#branches[@]} -gt 0 ]]; then
  delete_branches=$(dialog --title "待删除分支选择" --checklist "↑↓切换选项,空格选择,enter确认"  20 80 15 "${branches[@]}" 3>&1 1>&2 2>&3)
  exitstatus=$?
  if [ "$exitstatus" -eq 0 ]; then
    echo "已选择分支"
  else
    echo "取消了分支选择"
  fi
fi
# 针对选择的分支进行删除 
for branch in $delete_branches
do
  if [[ 
    "$branch" != ""
    && "$branch" != "HEAD"
    && "$branch" != "dev"
    && "$branch" != "master"
    && "$branch" != "production"
    ]]; then
    # echo -e "$branch\n"
    # 需要找到关联这个分支名称的是否有本地分支
    remote_branch=$(git rev-parse --symbolic-full-name $branch@{u})
    echo -e "远端分支：$remote_branch\n"
    # 删除远端分支
    if git rev-parse --verify $remote_branch >/dev/null 2>&1; then
      echo "$remote_branch" | (cut -d '/' -f 4- | xargs -I {} git push origin --delete {})
      echo -e "远端分支$remote_branch 已删除\n"
    fi
    # 删除本地分支
    # git branch -D $branch
    # echo -e "本地分支$branch 已删除\n"
  fi          
done



