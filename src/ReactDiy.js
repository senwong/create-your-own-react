function createElement(type, props, ...childrenProps) {
	const children = childrenProps.map(i => {
		if (typeof i === 'string' || typeof i === 'number') {
			return {
				type: 'Text_Node',
				props: { nodeValue: i }
			}
		}
		return i;
	})
  const ele = {
    type: type,
    props: { ...props, children },
  };
  return ele;
}


let nextUnitOfWork = null
let wipRoot = null;
let currentRoot = null;
let deletions = null;

function render(element, container) {
	// while (container.firstChild) {
	// 	container.removeChild(container.firstChild);
	// }
	wipRoot = {
		dom: container,
		props: {
			children: [element]
		},
		alternate: currentRoot,
	}
	nextUnitOfWork = wipRoot;
	deletions = [];
	window.requestIdleCallback(workLoop);
	// container.appendChild(renderElement(element))
}
const isEvent = key => key.startsWith('on');
const isProperty = key => key !== 'children';
const isNew = (prev, next) => key => prev[key] !== next[key];
const isGone = (prev, next) => key => !(key in next);
function updateDom(domNode, prevProps, nextProps) {

	// remove old event listener
	Object.keys(prevProps)
		.filter(isEvent)
		.filter(key => !(key in nextProps) || isNew(prevProps, nextProps)(key))
		.forEach(key => {
			const eventType = key.toLowerCase().substring(2);
			domNode.removeEventListener(eventType, prevProps[key]);
		});

	// add new event listener
	Object.keys(nextProps)
		.filter(isEvent)
		.filter(isNew)
		.forEach(key => {
			const eventType = key.toLowerCase().substring(2);
			domNode.addEventListener(eventType, nextProps[key]);
		});

	Object.keys(prevProps)
		.filter(isProperty)
		.filter(isGone(prevProps, nextProps))
		.forEach(key => domNode[key] = '');
	Object.keys(nextProps)
		.filter(isProperty)
		.filter(isNew(prevProps, nextProps))
		.forEach(key => domNode[key] = nextProps[key])
}

function commitDelete(fiber, domParent) {
	if (fiber.dom) {
		domParent.removeChild(fiber.dom)
	} else {
		commitDelete(fiber.child, domParent);
	}
}

function commitRoot() {
	deletions.forEach(commitWork)
	commitWork(wipRoot.child);
	currentRoot = wipRoot;
	wipRoot = null;
	function commitWork(fiber) {
		if (!fiber) {
			return;
		}
		let domParentFiber = fiber.parent;
		while (!domParentFiber.dom) {
			domParentFiber = domParentFiber.parent;
		}
		const domParent = domParentFiber.dom;
		if (fiber.effectTag === 'PLACEMENT' && fiber.dom) {
			domParent.appendChild(fiber.dom);
		} else if (fiber.effectTag === 'DELETION') {
			commitDelete(fiber, domParent)
		} else if (fiber.effectTag === 'UPDATE' && fiber.dom) {
			updateDom(fiber.dom, fiber.alternate.props, fiber.props);
		}
		
		commitWork(fiber.child);
		commitWork(fiber.sibling);
	}
}


function workLoop(deadLine) {
    let shouldYield = false;
    while (nextUnitOfWork && !shouldYield) {
				nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
        shouldYield = deadLine.timeRemaining() < 1;
		}
		if (!nextUnitOfWork && wipRoot) {
			commitRoot()
		}
		console.log('next idle callback')
		requestIdleCallback(workLoop)
}


function createDom(fiber) {
	const node = fiber.type === 'Text_Node'
		? document.createTextNode('')
		: document.createElement(fiber.type);
	updateDom(node, {}, fiber.props);
	return node;
}


function reconcileChildren(wipFiber, elements) {
	let index = 0;
	let prevSibling = null;

	let oldFiber = wipFiber.alternate && wipFiber.alternate.child;
	
	while (index < elements.length || oldFiber) {
		const element = elements[index];
		let newFiber = null

		const sameType = element && oldFiber && element.type === oldFiber.type;
		if (sameType) {
			// update the node
			newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom,
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: "UPDATE",
      }
		}
		if (element && !sameType) {
			// add this node
			newFiber = {
				type: element.type,
				props: element.props,
				dom: null,
				parent: wipFiber,
				alternate: null,
				effectTag: "PLACEMENT",
			}
		}
		if (oldFiber && !sameType) {
			// delete the oldFiber's node
			oldFiber.effectTag = "DELETION"
      deletions.push(oldFiber)
    }

		if (index === 0) {
			wipFiber.child = newFiber;
		} else {
			prevSibling.sibling = newFiber;
		}
		prevSibling = newFiber;
		if (oldFiber) {
			oldFiber = oldFiber.sibling;
		}
		index++;
	}
}


let wipFiber = null
let hookIndex = 0;
function updateFunctionComponent(fiber) {
	wipFiber = fiber
	hookIndex = 0;
	wipFiber.hooks = [];
	const children = [fiber.type(fiber.props)];
	reconcileChildren(fiber, children);
}

function useState(initial) {
	
	const oldHook = wipFiber.alternate && wipFiber.alternate.hooks && wipFiber.alternate.hooks[hookIndex]

	const hook = {
		state: oldHook ? oldHook.state : initial,
		queue: [],
	}
	const actions = oldHook ? oldHook.queue : [];
	actions.forEach(action => {
		hook.state = action(hook.state);
	});
	const setState = action => {
		hook.queue.push(action);
		wipRoot = {
			dom: currentRoot.dom,
			props: currentRoot.props,
      alternate: currentRoot,
		}
		nextUnitOfWork = wipRoot
		deletions = [];
	}

	wipFiber.hooks.push(hook);
	hookIndex++;
	return [hook.state, setState]
}

function updateHostComponent(fiber) {
	if (!fiber.dom) {
		fiber.dom = createDom(fiber);
	}

	const elements = fiber.props.children;
	// children of Text_Node type fiber is string, no need to create fiber
	if (Array.isArray(elements)) {
		reconcileChildren(fiber, elements);
	}

}

function performUnitOfWork(fiber) {
	if (typeof fiber.type === 'function') {
		updateFunctionComponent(fiber);
	} else {
		updateHostComponent(fiber);
	}


	if (fiber.child) {
		return fiber.child;
	}
	let nextFiber = fiber;
	while (nextFiber) {
		if (nextFiber.sibling) {
			return nextFiber.sibling
		}
		nextFiber = nextFiber.parent;
	}
}


export default { createElement, render, useState };
