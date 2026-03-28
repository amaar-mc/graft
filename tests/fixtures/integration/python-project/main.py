# Entry point for the python-project fixture
from .models import User, Post


def create_sample_post() -> Post:
    author = User(user_id="1", name="Alice", email="alice@example.com")
    return Post(post_id="p1", title="Hello World", author=author)


def describe_post(post: Post) -> str:
    return post.describe()
