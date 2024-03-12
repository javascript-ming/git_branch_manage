/*
 * @Author       : xiaomingming
 * @Date         : 2024-01-29 11:08:36
 * @LastEditTime : 2024-01-30 18:12:40
 * @LastEditors  : xiaomingming
 * @Description  : node脚本：git分支管理。注意npm i -D prompts cli-spinners chalk
 * @FilePath     : \git_branch_manage\git_branch_crud_node.js
 */
const util = require('util');
const { execSync } = require('child_process')
const exec = util.promisify(require('child_process').exec)
const prompts = require('prompts');
const cliSpinners = require('cli-spinners')
const chalk = require('chalk');

const STASHEDBRACHES = ['HEAD', 'dev', 'master', 'production']

function clearConsole() {
  // console.log('\n'.repeat(n || 1))
  process.stdout.clearLine(0) // 清除当前行
  process.stdout.cursorTo(0) // 将光标移动到行首
}
function getRandomColor() {
  const random255 = () => Math.floor(Math.random() * 256);
  const red = random255();
  const green = random255();
  const blue = random255();
  return chalk.rgb(red, green, blue);
}

function showLoading(text) {
  let i = 0;
  const spinner = cliSpinners.dots;
  const intervalId = setInterval(() => {
    const frame = spinner.frames[i];
    const coloredFrame = getRandomColor()(frame);
    process.stdout.write('\r' + text + ' ' + coloredFrame + '   ');
    i = (i + 1) % spinner.frames.length;
  }, spinner.interval);

  return intervalId;
}

function hideLoading(intervalId, text) {
  clearInterval(intervalId);
  clearConsole()
}
/**
 * @Description  : 拉取远端并新建本地分支
 * @return        {*}
 */
const fetchAndCreateBranches = async () => {
  clearConsole()
  const loading = showLoading('分析分支中')
  try {
    // 拉取所有远程分支
    await exec('git fetch origin')
    // 获取所有远程分支的名字
    const { stdout: remoteBranchesStdout } = await exec('git branch -r')
    const remoteBranches = remoteBranchesStdout.split('\n').map(branch => branch.trim().replace('origin/', ''));
    // 遍历所有远程分支
    for (const branch of remoteBranches) {
      const shortName = branch.replace('origin/', '')
      if (!shortName || shortName.includes('->')) {
        continue
      }
      // 检查本地是否已经存在这个分支
      try {
        await exec(`git rev-parse --quiet --verify ${branch}`);
      } catch (error) {
        // 如果本地不存在这个分支，那么创建这个分支并设置其跟踪远程分支
        try {
          await exec(`git branch ${branch} origin/${branch}`)
        } catch (error) {
          // console.error(`Error creating branch ${branch}: ${error}`)
        }
      }
    }
    hideLoading(loading)
  } catch (error) {
    console.error(`Error: ${error}`);
  }
}
// 获取远程已合并master分支的列表
const getRemoteBranches = async() => {
  await exec('git fetch -a')
  const format = '%(refname:short) %(objectname:short) %(authordate:unix) %(refname)'
  const cmd = `git for-each-ref --merged master --format="${format}" refs/heads`
  const output = execSync(cmd).toString();
  return output.trim().split('\n').map(branch => branch.trim());
};

// 获取所有合并到production分支的列表
const getProductionMergedBranches = async() => {
  await exec('git fetch -a')
  const format = '%(refname:short) %(objectname:short) %(authordate:unix) %(refname)'
  const cmd = `git for-each-ref --merged production --format="${format}" refs/heads`
  const output = execSync(cmd).toString();
  return output.trim().split('\n').map(branch => branch.trim());
};
// 删除远程分支
const deleteRemoteBranch = async(filterBranches) => {
  for (let i = 0; i < filterBranches.length;i++) {
    const cur = filterBranches[i].split('++')
    const shortName = cur[0]
    if (STASHEDBRACHES.includes(shortName)) {
      continue
    }
    // 获取跟踪的远端分支
    const remoteBranchStr = execSync(`git rev-parse --symbolic-full-name ${shortName}@{u}`).toString().trim().split('\n').map(branch => branch.trim())
    if (!remoteBranchStr.length) {
      console.log(`${shortName}没跟踪的远程分支`)
      continue
    }
    // 根据分支名称判断分支是否存在，存在就删除
    const verifyBuffer = execSync(`git rev-parse --verify ${remoteBranchStr[0]}`);
    const verify = verifyBuffer.toString().trim();

    if (!verify) {
      console.log(`${shortName}的远程分支不存在了`);
      continue
    }
    // `${remoteBranchStr} | (cut -d '/' -f 4- | xargs -I {} git push origin --delete {})`
    try {
      execSync(`git push origin --delete ${shortName}`)
      console.log(`远端${remoteBranchStr}分支已删除`)
    } catch (error) {
      console.log(error)
    }
  }
};

/**
 * @Description  : 删除本地分支
 * @param         {[String]} filterBranches
 * @return        {*}
 */
const deleteLocalBranch = async (filterBranches) => {
  for (let i = 0; i < filterBranches.length;i++) {
    const cur = filterBranches[i].split('++')
    const shortName = cur[0]
    if (STASHEDBRACHES.includes(shortName)) {
      continue
    }
    try {
      execSync(`git branch -D ${shortName}`)
      console.log(`${shortName}的本地分支已删除`)
    } catch (error) {
      console.log(error)
    }
  }
}
// 获取筛选后的分支列表
const getFilterBranches = async(remoteBranches, startDate, endDate) => {
  const mergedProductionBranchs = await getProductionMergedBranches()
  const filterBranchs = []
  remoteBranches.forEach((branch) => {
    const branchMetaList = branch.split(' ')
    // 根据日期做分支筛选
    // 如果该分支没有合并到 production 则不添加到待删除分支
    const dateStampStr = branchMetaList[2];
    const authordateStamp = Number(dateStampStr) * 1000;
    if (authordateStamp >= startDate && authordateStamp < endDate) {
      const branchName = branchMetaList[0]; // shortName
      if (branchName.includes('backup')) {
        return
      }
      try {
        // 是否合并production
        if (mergedProductionBranchs.some(x => x.includes(branchName))) {
          const humanTime = new Date(authordateStamp).toLocaleDateString()
          filterBranchs.push(branchName + '++' + humanTime + '++' + branchMetaList[2])
        }
        // const humanTime = new Date(authordateStamp).toLocaleDateString()
        // filterBranchs.push(branchName + '++' + humanTime + '++' + branchMetaList[2])
      } catch (error) {
        console.error(error.message)
      }
    }
  })
  return filterBranchs;
};
const showBranchesCheckboxOptions = (branches) => {
  const questions = {
    type: 'multiselect',
    name: 'confirmedBranchs',
    message: '请选择一个或多个',
    choices: branches,
    optionsPerPage: 30
  }
  // console.log(questions)
  return questions
}

const deleteStrategyCheckboxOptions = (branches) => {
  const questions = {
    type: 'select',
    name: 'delStrategy',
    message: '请选择删除策略',
    choices: [
      { title: '删除远端+本地', value: 'all' },
      { title: '仅删除远端', value: 'remote' },
      { title: '仅删除本地', value: 'local' }
    ],
    initial: 1
  }
  return questions
}

const main = async () => {
  // 拉去所有远端分支并创建本地分支
  await fetchAndCreateBranches()
  // 获取远程已合并master分支的列表
  const remoteBranches = await getRemoteBranches()
  // 选择过期日期
  const response1 = await prompts([
    {
      type: 'date',
      name: 'selectedDate',
      message: '请选择过期分支的开始时间：'
    }
  ]);

  const startDate = (new Date(response1.selectedDate).valueOf());
  const response2 = await prompts([
    {
      type: 'date',
      name: 'selectedDate',
      message: '请选择过期分支的结束时间：'
    }
  ]);

  const endDate = (new Date(response2.selectedDate).valueOf());
  // 根据日期做分支筛选
  const filterBranches = await getFilterBranches(remoteBranches, startDate, endDate)
  // 根据filterBranches 弹出checkbox列表
  const selected = await prompts(showBranchesCheckboxOptions(filterBranches), {
    onCancel: () => {
      process.exit()
    },
    onState: (state) => {
      if (state.aborted) {
        console.clear()
      }
    }
  })
  // 根据选择的分支执行删除分支命令
  if (!selected.confirmedBranchs.length) {
    console.log('您取消了选择')
    return
  }
  const selectedBranches = selected.confirmedBranchs.map(idx => filterBranches[idx])
  // 删除策略默认是远端+本地都删除
  const delStrategy = await prompts(deleteStrategyCheckboxOptions(), {
    onCancel: () => {
      process.exit()
    },
    onState: (state) => {
      if (state.aborted) {
        console.clear()
      }
    }
  })
  switch (delStrategy.delStrategy) {
    case 'all': {
      await deleteRemoteBranch(selectedBranches)
      deleteLocalBranch(selectedBranches)
      break
    }
    case 'remote': {
      deleteRemoteBranch(selectedBranches)
      break
    }
    case 'local': {
      deleteLocalBranch(selectedBranches)
      break
    }
    default: {
      break
    }
  }
};
main();
