import { Suspense, type Component } from 'solid-js';

const App: Component = (props: { children: Element }) => {
  return (
    <div class="min-h-screen">
      <main class="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <Suspense>{props.children}</Suspense>
      </main>
    </div>
  );
};

export default App;
