import pygame
import random
import sys

# Initialize Pygame
pygame.init()

# Set up some constants
WIDTH = 800
HEIGHT = 600
BLOCK_SIZE = 20
FPS = 10

# Set up some colors
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
RED = (255, 0, 0)
GREEN = (0, 255, 0)

# Set up the display
win = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption('Snake Game')

# Set up the font
font = pygame.font.Font(None, 36)

# Set up the clock
clock = pygame.time.Clock()

class SnakeGame:
    def __init__(self):
        self.snake = [(200, 200), (220, 200), (240, 200)]
        self.direction = 'right'
        self.apple = self.generate_apple()

    def generate_apple(self):
        while True:
            x = random.randint(0, WIDTH - BLOCK_SIZE) // BLOCK_SIZE * BLOCK_SIZE
            y = random.randint(0, HEIGHT - BLOCK_SIZE) // BLOCK_SIZE * BLOCK_SIZE
            if (x, y) not in self.snake:
                return (x, y)

    def draw(self, win):
        win.fill(BLACK)
        for x, y in self.snake:
            pygame.draw.rect(win, GREEN, (x, y, BLOCK_SIZE, BLOCK_SIZE))
        pygame.draw.rect(win, RED, (*self.apple, BLOCK_SIZE, BLOCK_SIZE))
        text = font.render(f'Score: {len(self.snake)}', True, WHITE)
        win.blit(text, (10, 10))
        pygame.display.update()

    def move(self):
        head = self.snake[-1]
        if self.direction == 'right':
            new_head = (head[0] + BLOCK_SIZE, head[1])
        elif self.direction == 'left':
            new_head = (head[0] - BLOCK_SIZE, head[1])
        elif self.direction == 'up':
            new_head = (head[0], head[1] - BLOCK_SIZE)
        elif self.direction == 'down':
            new_head = (head[0], head[1] + BLOCK_SIZE)

        self.snake.append(new_head)
        if self.snake[-1] == self.apple:
            self.apple = self.generate_apple()
        else:
            self.snake.pop(0)

        if (self.snake[-1][0] < 0 or self.snake[-1][0] >= WIDTH or
            self.snake[-1][1] < 0 or self.snake[-1][1] >= HEIGHT or
            self.snake[-1] in self.snake[:-1]):
            pygame.quit()
            sys.exit()

    def play(self):
        while True:
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    pygame.quit()
                    sys.exit()
                elif event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_UP and self.direction != 'down':
                        self.direction = 'up'
                    elif event.key == pygame.K_DOWN and self.direction != 'up':
                        self.direction = 'down'
                    elif event.key == pygame.K_LEFT and self.direction != 'right':
                        self.direction = 'left'
                    elif event.key == pygame.K_RIGHT and self.direction != 'left':
                        self.direction = 'right'

            self.move()
            self.draw(win)
            clock.tick(FPS)

if __name__ == '__main__':
    game = SnakeGame()
    game.play()