import { exec } from 'child_process';

class GitWatcher {
  private isUpdating = false;

  public start() {
    if (process.env.AUTO_UPDATE !== 'true') return;
    setInterval(() => this.checkForUpdates(), 30000);
  }

  private async checkForUpdates() {
    if (this.isUpdating) return;
    
    // Проверяем удаленный репозиторий без скачивания
    exec('cd /app/repo && git fetch origin main && git status -uno', (err, stdout) => {
      if (stdout.includes('Your branch is behind')) {
        console.log('🔄 [GitWatcher] New version detected. Pulling changes...');
        this.performUpdate();
      }
    });
  }

  private performUpdate() {
    this.isUpdating = true;
    const cmd = 'cd /app/repo && git pull origin main && docker compose up -d --build';
    
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        console.error('❌ [GitWatcher] Update failed:', stderr);
        this.isUpdating = false;
        return;
      }
      console.log('✅ [GitWatcher] Update applied. Containers restarting...');
    });
  }
}

export const gitWatcher = new GitWatcher();