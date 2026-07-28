import { exec } from 'child_process';

class GitWatcher {
  private isUpdating = false;
  private checkInterval = 30000;

  public start() {
    if (process.env.AUTO_UPDATE !== 'true') return;
    
    console.log('🔄 GitWatcher: Monitoring for updates...');
    setInterval(() => this.checkForUpdates(), this.checkInterval);
    this.checkForUpdates();
  }

  private async checkForUpdates() {
    if (this.isUpdating) return;

    // Проверяем наличие обновлений в main
    const checkCmd = 'cd /app/repo && git fetch origin main && git rev-parse HEAD && git rev-parse origin/main';
    
    exec(checkCmd, (err, stdout) => {
      if (err) return;

      const hashes = stdout.trim().split('\n');
      if (hashes.length === 2 && hashes[0] !== hashes[1]) {
        console.log(`🚀 Update detected! ${hashes[0].substring(0,7)} -> ${hashes[1].substring(0,7)}`);
        this.performUpdate();
      }
    });
  }

  private performUpdate() {
    this.isUpdating = true;
    
    // Выполняем pull и пересборку всех активных контейнеров
    const updateCmd = 'cd /app/repo && git pull origin main && docker compose up -d --build';
    
    exec(updateCmd, (err, stdout, stderr) => {
      if (err) {
        console.error('❌ Update failed:', stderr);
        this.isUpdating = false;
        return;
      }
      console.log('✅ Update successful. Services are restarting...');
    });
  }
}

export const gitWatcher = new GitWatcher();