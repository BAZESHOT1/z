import { exec } from 'child_process';
import { config } from '../config';

class GitWatcher {
  private isUpdating = false;

  public start() {
    if (process.env.AUTO_UPDATE !== 'true') return;
    
    console.log('🔄 GitWatcher: Monitoring for updates...');
    // Проверка каждую минуту
    setInterval(() => this.checkForUpdates(), 60000);
  }

  private async checkForUpdates() {
    if (this.isUpdating) return;

    // Переходим в папку монтированного репозитория и проверяем статус
    const cmd = 'cd /app/repo && git fetch origin && git status -uno';
    
    exec(cmd, (err, stdout) => {
      if (stdout && stdout.includes('Your branch is behind')) {
        console.log('🚀 New version detected! Starting update process...');
        this.isUpdating = true;
        this.performUpdate();
      }
    });
  }

  private performUpdate() {
    // 1. Стягиваем код
    // 2. Пересобираем и перезапускаем через докер хоста
    const updateCmd = 'cd /app/repo && git pull && docker compose up -d --build';
    
    exec(updateCmd, (err, stdout, stderr) => {
      if (err) {
        console.error('❌ Update failed:', stderr);
        this.isUpdating = false;
        return;
      }
      console.log('✅ Update successful. Docker is restarting containers...');
      // Контейнер сам умрет и заменится новым после этой команды
    });
  }
}

export const gitWatcher = new GitWatcher();