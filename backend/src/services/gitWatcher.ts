import { exec } from 'child_process';

class GitWatcher {
  private isUpdating = false;
  private checkInterval = 30000; // Проверка каждые 30 секунд

  public start() {
    if (process.env.AUTO_UPDATE !== 'true') {
      console.log('ℹ️ GitWatcher: Auto-update is disabled.');
      return;
    }
    
    console.log('🔄 GitWatcher: Monitoring for updates via commit hashes...');
    setInterval(() => this.checkForUpdates(), this.checkInterval);
    // Проверяем сразу при старте
    this.checkForUpdates();
  }

  private async checkForUpdates() {
    if (this.isUpdating) return;

    // 1. Получаем хэш локальной ветки и удаленной
    const checkCmd = 'cd /app/repo && git fetch origin main && git rev-parse HEAD && git rev-parse origin/main';
    
    exec(checkCmd, (err, stdout) => {
      if (err) {
        console.error('❌ GitWatcher: Failed to fetch or compare hashes. Check git credentials.');
        return;
      }

      const [localHash, remoteHash] = stdout.trim().split('\n');
      
      if (localHash && remoteHash && localHash !== remoteHash) {
        console.log(`🚀 GitWatcher: Update detected! Local: ${localHash.substring(0,7)}, Remote: ${remoteHash.substring(0,7)}`);
        this.performUpdate();
      }
    });
  }

  private performUpdate() {
    this.isUpdating = true;
    
    // Команда для обновления: тянем код и просим докер пересобрать и перезапустить сервисы
    // Используем --no-deps чтобы не трогать базу, если не нужно
    const updateCmd = 'cd /app/repo && git pull origin main && docker compose up -d --build z-backend community-backend';
    
    console.log('⏳ GitWatcher: Executing update command...');
    
    exec(updateCmd, (err, stdout, stderr) => {
      if (err) {
        console.error('❌ GitWatcher: Update failed!', stderr);
        this.isUpdating = false;
        return;
      }
      console.log('✅ GitWatcher: Update successful. Container will now restart.');
      // После docker compose up контейнер получит сигнал завершения и будет заменен новым
    });
  }
}

export const gitWatcher = new GitWatcher();